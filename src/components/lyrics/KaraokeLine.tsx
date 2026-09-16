import { useEffect, useRef } from 'react'
import { audio } from '../../audio/engine'
import { useSettingsStore } from '../../stores/settings'
import { cn } from '../../lib/format'

/**
 * One lyric line with a karaoke fill.
 *
 * The line is painted twice: a dim base, and an accent copy clipped to the
 * position being sung. The clip advances with the track clock, so the
 * highlight moves across the sentence word by word instead of the whole line
 * lighting up at once.
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

  useEffect(() => {
    if (!active || !animate) return
    let raf = 0
    const span = Math.max(0.7, to - from)
    const paint = () => {
      const el = fillRef.current
      if (!el) return
      const p = Math.max(0, Math.min(1, (audio.currentTime - from) / span))
      el.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`
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
  }, [active, from, to, animate])

  return (
    <span className={cn('lyric-karaoke', !animate && 'karaoke-off', className)} style={style}>
      <span className="lk-base">{text}</span>
      {active && animate && (
        <span ref={fillRef} className="lk-fill" aria-hidden="true">
          {text}
        </span>
      )}
    </span>
  )
}
