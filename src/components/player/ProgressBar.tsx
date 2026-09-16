import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../../stores/player'
import { audio } from '../../audio/engine'
import { cn } from '../../lib/format'

/**
 * Silky progress bar: the fill is driven from the audio clock by rAF (never by
 * React state), and the bar itself is a click/drag seek target.
 *
 * It lives in its own module because it is the one piece of the retired control
 * bar the music space still uses.
 */
export function ProgressBar({ compact = false }: { compact?: boolean }) {
  const fillRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const [dragging, setDragging] = useState(false)
  const [dragPct, setDragPct] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = fillRef.current
      const d = audio.duration
      if (el && d > 0 && !dragging) {
        // a transform, not a width: the fill is rewritten every frame and width
        // forces a layout pass each time
        el.style.transform = `scaleX(${audio.currentTime / d})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragging])

  const pctAt = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  const pct = dragging ? dragPct : duration ? position / duration : 0

  return (
    <div
      ref={wrapRef}
      className={cn('group relative flex w-full cursor-pointer touch-none items-center', compact ? 'h-4' : 'h-5')}
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(position)}
      tabIndex={0}
      onPointerDown={(e) => {
        if (!duration) return
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        setDragging(true)
        setDragPct(pctAt(e.clientX))
      }}
      onPointerMove={(e) => { if (dragging) setDragPct(pctAt(e.clientX)) }}
      onPointerUp={(e) => {
        if (!dragging) return
        const p = pctAt(e.clientX)
        setDragging(false)
        seek(p * duration)
      }}
      // a cancelled pointer or a stolen capture ends the drag too, otherwise the
      // fill stops following the audio for the rest of the track
      onPointerCancel={() => setDragging(false)}
      onLostPointerCapture={() => setDragging(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.stopPropagation(); seek(Math.min(duration, position + 5)) }
        if (e.key === 'ArrowLeft') { e.stopPropagation(); seek(Math.max(0, position - 5)) }
      }}
    >
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/12 transition-all', compact ? 'h-[3px]' : 'h-[5px] group-hover:h-[7px]')}>
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
          style={{
            transform: `scaleX(${pct})`,
            background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-2))',
            boxShadow: '0 0 12px var(--c-glow)',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ left: `${pct * 100}%`, boxShadow: '0 0 0 4px var(--c-glow-soft), 0 2px 8px rgba(0,0,0,0.5)', opacity: dragging ? 1 : undefined }}
      />
    </div>
  )
}
