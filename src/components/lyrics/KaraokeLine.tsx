import { useEffect, useMemo, useRef } from 'react'
import { audio } from '../../audio/engine'
import { useSettingsStore } from '../../stores/settings'
import { cn } from '../../lib/format'

/**
 * One lyric line with a karaoke fill.
 *
 * The line is painted twice — a dim base and an accent copy — and the accent
 * copy is revealed left to right as the line is sung.
 *
 * The reveal is applied **per word**, not to the line's box. A single clipping
 * rectangle over the whole line was wrong the moment a line wrapped: the
 * rectangle spans both rows, so both rows lit up together and the second row
 * came in before the first had finished. Words are inline-block atoms (an inline
 * box cannot carry a clip), so each carries its own clip and the sweep carries
 * on to the next row in reading order.
 */
export function KaraokeLine({
  text,
  from,
  to,
  active,
  className,
  style,
}: {
  text: string
  /** seconds when this line starts */
  from: number
  /** seconds when the next line starts (or the line's end) */
  to: number
  active: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const animate = useSettingsStore((s) => s.settings.lyrics.animate)

  const parts = useMemo(() => text.split(/(\s+)/).filter((s) => s.length > 0), [text])
  // the words, each with the moment it should start as a fraction of the line
  const words = useMemo(() => {
    const out: Array<{ text: string; at: number }> = []
    const weights = parts.map((p) => (/^\s+$/.test(p) ? 0.34 : p.length))
    const total = weights.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    parts.forEach((p, i) => {
      if (!/^\s+$/.test(p)) out.push({ text: p, at: acc / total })
      acc += weights[i]
    })
    return out
  }, [parts])

  useEffect(() => {
    if (!active || !animate) return
    let raf = 0
    const span = Math.max(0.7, to - from)

    const paint = () => {
      const el = fillRef.current
      const nodes = el?.querySelectorAll<HTMLElement>('[data-w]')
      if (!el || !nodes || !nodes.length) return
      // The layer ships with `clip-path: inset(0 100% 0 0)` in CSS — a fully
      // clipped starting state. The old code overwrote it every frame because it
      // clipped this very element; now that the clipping moved to the words, the
      // layer's own clip has to be released or nothing is ever visible.
      if (el.style.clipPath !== 'none') el.style.clipPath = 'none'
      const p = Math.max(0, Math.min(1, (audio.currentTime - from) / span))
      for (let i = 0; i < nodes.length; i++) {
        const a = words[i]?.at ?? 0
        const b = words[i + 1]?.at ?? 1
        const q = Math.max(0, Math.min(1, (p - a) / Math.max(0.001, b - a)))
        nodes[i].style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(2)}% 0 0)`
      }
    }

    const tick = () => { paint(); raf = requestAnimationFrame(tick) }
    paint() // paint once now, so the line is never stuck before the first frame
    raf = requestAnimationFrame(tick)
    // animation frames pause in a hidden tab — repaint the moment it returns
    document.addEventListener('visibilitychange', paint)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', paint)
    }
  }, [active, from, to, animate, words])

  return (
    <span className={cn('lyric-karaoke', !animate && 'karaoke-off', className)} style={style}>
      <span className="lk-base">{text}</span>
      {active && animate && (
        <span ref={fillRef} className="lk-fill" aria-hidden="true">
          {parts.map((p, i) =>
            /^\s+$/.test(p)
              ? p
              : <span key={i} data-w style={{ display: 'inline-block' }}>{p}</span>,
          )}
        </span>
      )}
    </span>
  )
}
