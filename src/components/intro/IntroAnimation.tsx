import { useEffect, useRef, useState } from 'react'
import { IntroSequence } from './IntroSequence'
import { useSettingsStore } from '../../stores/settings'

/**
 * The MH Music opening: a real 3D turntable, rendered with Three.js.
 *
 * The deck is modelled geometry under studio lighting (see `three/turntable`),
 * the shot is choreographed by `three/introDirector`, and the pixel
 * disintegration is a shader pass over the rendered frame — so the object
 * genuinely breaks into blocks rather than cross-fading into a sprite sheet.
 *
 * Three.js is ~550 kB, so it is imported dynamically: the product ships without
 * it and the 3D module streams in while the canvas is already mounted. If the
 * device cannot give us a WebGL context (or the user has motion turned off in
 * their system settings), the orchestrated CSS 3D deck from the earlier build
 * takes over, so the product never opens on a black screen.
 */
export function IntroAnimation({ onLeaving, onDone }: { onLeaving?: () => void; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)
  // The shot fades in and out as a whole. That is what replaces the old
  // post-processed reveal: the machine still emerges out of black, and the
  // product still arrives through it, with nothing drawn over the turntable.
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const accent = useSettingsStore((s) => s.settings.dynamicColors ? undefined : '#9fd8ff')
  const controllerRef = useRef<{ skip: () => void } | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 40)
    // Watchdog: the overlay covers the whole page, so it must never be able to
    // outlive the shot. If anything stops the 3D from reaching its end — a lost
    // WebGL context, a stalled frame loop — the intro releases the page anyway.
    const guard = window.setTimeout(() => { setLeaving(true); onDone() }, 9000)
    return () => { window.clearTimeout(id); window.clearTimeout(guard) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let dispose: (() => void) | null = null

    ;(async () => {
      let THREE: typeof import('three')
      let createIntro: typeof import('../../three/introDirector')['createIntro']
      try {
        [THREE, { createIntro }] = await Promise.all([
          import('three'),
          import('../../three/introDirector'),
        ])
      } catch {
        setFailed(true)
        return
      }
      if (disposed) return

      let renderer: import('three').WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        })
        if (!renderer.getContext()) throw new Error('无法创建 WebGL 上下文')
      } catch {
        setFailed(true)
        return
      }

      renderer.setClearAlpha(0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.06
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const controller = createIntro(renderer, {
        // the overlay fades itself out as the product arrives underneath
        onLeaving: () => { setLeaving(true); onLeaving?.() },
        onDone,
        accent,
      })
      controllerRef.current = controller
      // development handle: lets the 3D shot be inspected live from the console
      if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mhIntro = controller.debug

      const fit = () => controller.resize(window.innerWidth, window.innerHeight, dpr)
      fit()
      window.addEventListener('resize', fit)
      dispose = () => {
        window.removeEventListener('resize', fit)
        controllerRef.current = null
        controller.dispose()
      }
    })()

    return () => {
      disposed = true
      dispose?.()
    }
    // the intro is a one-shot: it must never restart on a re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (failed) return <IntroSequence onLeaving={onLeaving} onDone={onDone} />

  return (
    <div
      className="fixed inset-0 z-[300] overflow-hidden"
      role="presentation"
      // The overlay is transparent except for the machine itself, and it fades
      // as a whole on the way out — that cross-fade is the entire transition,
      // so the shot needs no post-processing to hand over to the product.
      style={{
        opacity: leaving ? 0 : entered ? 1 : 0,
        transition: leaving ? 'opacity 780ms ease' : 'opacity 950ms ease-out',
        // a transparent overlay still hit-tests, so the moment it starts leaving
        // it stops accepting pointer events entirely
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* the brand line, quiet under the deck */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[9%] text-center"
        style={{ opacity: leaving ? 0 : 0.5, transition: 'opacity 500ms ease' }}
      >
        <div className="mh-display text-[15px] tracking-[0.5em]" style={{ color: 'rgba(255,255,255,0.82)' }}>
          MH MUSIC
        </div>
        <div className="mh-overline mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Music Beyond Sound.</div>
      </div>

      <button
        className="glass-soft absolute bottom-6 right-6 z-10 rounded-full px-4 py-2 text-[12px] transition-opacity"
        style={{ color: 'var(--c-ink-dim)', opacity: leaving ? 0 : 1 }}
        onClick={() => controllerRef.current?.skip()}
      >
        跳过入场
      </button>
    </div>
  )
}
