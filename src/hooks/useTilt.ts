import { useCallback, useRef } from 'react'
import { useMotionValue, useSpring, type MotionStyle } from 'framer-motion'

export interface TiltApi {
  style: MotionStyle
  onMouseMove: (e: React.MouseEvent) => void
  onMouseLeave: () => void
}

/** Mouse-follow 3D tilt with spring return (for album art / covers). */
export function useTilt(maxDeg = 9, scale = 1.02): TiltApi {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const sc = useMotionValue(1)
  const srx = useSpring(rx, { stiffness: 180, damping: 18, mass: 0.6 })
  const sry = useSpring(ry, { stiffness: 180, damping: 18, mass: 0.6 })
  const ssc = useSpring(sc, { stiffness: 220, damping: 20 })
  const frame = useRef(0)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      ry.set(px * maxDeg * 2)
      rx.set(-py * maxDeg * 2)
      sc.set(scale)
    })
  }, [maxDeg, scale, rx, ry, sc])

  const onMouseLeave = useCallback(() => {
    rx.set(0); ry.set(0); sc.set(1)
  }, [rx, ry, sc])

  return {
    style: { rotateX: srx, rotateY: sry, scale: ssc, transformPerspective: 900 },
    onMouseMove,
    onMouseLeave,
  }
}
