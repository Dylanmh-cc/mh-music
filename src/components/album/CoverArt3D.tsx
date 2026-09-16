import { memo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTilt } from '../../hooks/useTilt'
import { useAudioReactive } from '../../hooks/useAudioReactive'
import { useAlbumLayout, layoutTransform } from './layout'
import type { Levels } from '../../audio/engine'
import { useCallback } from 'react'
import { cn } from '../../lib/format'

interface Props {
  albumId?: string
  url: string
  name: string
  size?: 'panel' | 'hero' | 'space' | 'card'
  tilt?: boolean
  breathe?: boolean
  className?: string
}

/**
 * Album artwork as a physical object: custom 3D layout, mouse tilt with
 * spring return, reflection, adjustable shadow, and a gentle audio "breath".
 */
export const CoverArt3D = memo(function CoverArt3D({ albumId, url, name, size = 'panel', tilt = true, breathe = true, className }: Props) {
  const { layout } = useAlbumLayout(albumId)
  const tiltApi = useTilt(size === 'hero' ? 7 : 9)
  const breatheRef = useRef<HTMLDivElement | null>(null)

  const onFrame = useCallback((el: HTMLElement, l: Levels) => {
    el.style.setProperty('--breath', String(1 + l.bass * 0.022))
  }, [])
  const breath = useAudioReactive(onFrame)

  // `dataset.motion` is the string 'on' or 'off' — testing its truthiness turned
  // the tilt off for everyone. A per-frame `filter` write on every sleeve was
  // also the expensive half of the breathing effect, so only the cheap transform
  // is driven from the audio frame.
  const interactive = tilt && document.documentElement.dataset?.motion !== 'off'
  const perspective = size === 'space' ? 1200 : 900

  return (
    <div
      ref={breath ? (breath as React.RefObject<HTMLDivElement>) : undefined}
      className={cn('relative w-full', className)}
      style={{ ['--breath' as any]: 1 }}
    >
      <motion.div
        {...(interactive ? tiltApi : {})}
        className="relative"
        style={{ perspective, transformStyle: 'preserve-3d' }}
      >
        <div
          className="cover-3d relative overflow-hidden rounded-[7%]"
          style={{
            aspectRatio: '1',
            transform: layoutTransform(layout),
            boxShadow: `0 ${26 * layout.shadow}px ${70 * layout.shadow}px rgba(0,0,0,0.55), 0 ${8 * layout.shadow}px ${22 * layout.shadow}px rgba(0,0,0,0.4), 0 0 ${50 * layout.shadow}px var(--c-glow-soft), inset 0 1px 0 rgba(255,255,255,0.14)`,
            zIndex: 2,
          }}
        >
          <img
            src={url}
            alt={`${name} 专辑封面`}
            className="h-full w-full select-none object-cover"
            draggable={false}
            loading="lazy"
            style={{ transform: 'scale(var(--breath, 1))', transition: 'transform 80ms linear' }}
          />
          {/* glass sheen — artwork stays edge-to-edge, no bars or borders */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.14) 0%, transparent 28%, transparent 74%, rgba(255,255,255,0.05) 100%)' }}
          />
        </div>

        {/* reflection */}
        {layout.reflection > 0.01 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-full w-full overflow-hidden rounded-[7%]"
            style={{
              height: '42%',
              opacity: layout.reflection * 0.5,
              transform: `scaleY(-1) translateY(${layout.depth * 0.1}px) ${layoutTransform(layout)}`,
              transformOrigin: 'top center',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 70%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 70%)',
              zIndex: 1,
              marginTop: 8 * layout.depth * 0.02,
            }}
          >
            <img src={url} alt="" className="h-[240%] w-full object-cover" draggable={false} />
          </div>
        )}
      </motion.div>
    </div>
  )
})
