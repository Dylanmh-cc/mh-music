import { memo, useEffect, useRef } from 'react'
import { cn } from '../../lib/format'
import { useSettingsStore } from '../../stores/settings'

/**
 * Reusable CSS vinyl disc (grooves + palette label + sheen).
 *
 * The rotation is driven in JS rather than by a CSS keyframe: a record should
 * spin up and, when you pause, *wind down* under its own momentum instead of
 * stopping dead. `.vinyl-inertia` reads the angle from a custom property.
 */
export const VinylDisc = memo(function VinylDisc({
  spinning,
  speed = 'normal',
  className,
  labelUrl,
}: {
  spinning: boolean
  speed?: 'normal' | 'slow'
  className?: string
  labelUrl?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const animations = useSettingsStore((s) => s.settings.animations)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // ~33⅓ rpm at 3.2s per turn; the slow variant is for decorative discs
    const target = speed === 'slow' ? 42 : 112.5
    if (!animations) {
      el.style.setProperty('--vinyl-angle', '0deg')
      return
    }
    let raf = 0
    let last = performance.now()
    let angle = 0
    let vel = 0
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const want = spinning ? target : 0
      // spin up eagerly, coast down slowly — that asymmetry is the inertia
      vel += (want - vel) * Math.min(1, dt * (spinning ? 2.4 : 1.05))
      if (!spinning && vel < 0.6) vel = 0
      angle = (angle + vel * dt) % 360
      el.style.setProperty('--vinyl-angle', `${angle.toFixed(3)}deg`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spinning, speed, animations])

  return (
    <div
      ref={ref}
      className={cn('vinyl vinyl-inertia', className)}
      data-spinning={spinning ? 'true' : 'false'}
      role="img"
      aria-label="黑胶唱片"
    >
      {labelUrl ? (
        <div className="absolute inset-[34%] overflow-hidden rounded-full" style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.3)' }}>
          <img src={labelUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute left-1/2 top-1/2 h-[14%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a0b0e]" />
        </div>
      ) : (
        <div className="vinyl-label" />
      )}
    </div>
  )
})
