import { useEffect, useRef, useState } from 'react'
import { Turntable } from '../intro/IntroSequence'
import { useUiStore } from '../../stores/ui'
import type { DeckStageController } from '../../three/deckStage'

/**
 * The turntable block on the home page.
 *
 * It is the same Three.js deck the opening animation builds — the studio
 * environment, the machined platter, the arm, the brushed top plate — but held
 * still and behaving like a machine that is simply on: spinning while the
 * transport runs, coasting down when it stops, and printing the current album
 * on the label.
 *
 * Where there is no WebGL context, the CSS 3D deck takes over so the page never
 * loses its centrepiece.
 */
export function Deck3D({ cover, playing, accent, className }: {
  cover?: string
  playing: boolean
  accent?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const controllerRef = useRef<DeckStageController | null>(null)
  const [failed, setFailed] = useState(false)
  // The deck is a WebGL scene, so it stops drawing the moment it is off-screen
  // or behind the full-screen player: two live 3D contexts at once would take
  // the frame budget away from the music.
  const [onScreen, setOnScreen] = useState(true)
  const spaceOpen = useUiStore((s) => s.nowPlayingOpen)
  const paused = !onScreen || spaceOpen

  useEffect(() => {
    const el = canvasRef.current?.parentElement
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let cleanup: (() => void) | null = null

    ;(async () => {
      let THREE: typeof import('three')
      let createDeckStage: typeof import('../../three/deckStage')['createDeckStage']
      try {
        [THREE, { createDeckStage }] = await Promise.all([
          import('three'),
          import('../../three/deckStage'),
        ])
      } catch {
        setFailed(true)
        return
      }
      if (disposed) return

      let renderer: import('three').WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
        if (!renderer.getContext()) throw new Error('no webgl')
      } catch {
        setFailed(true)
        return
      }

      renderer.setClearAlpha(0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      const stage = createDeckStage(renderer, { cover, playing, accent })
      controllerRef.current = stage

      // the canvas is a fixed aspect box, so the deck is always framed the same
      const parent = canvas.parentElement
      const fit = () => {
        const r = parent?.getBoundingClientRect()
        const w = Math.max(320, Math.round(r?.width ?? 640))
        const h = Math.max(200, Math.round(r?.height ?? 320))
        stage.resize(w, h, Math.min(2, window.devicePixelRatio || 1))
      }
      fit()
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
      if (ro && parent) ro.observe(parent)
      window.addEventListener('resize', fit)
      cleanup = () => {
        ro?.disconnect()
        window.removeEventListener('resize', fit)
        controllerRef.current = null
        stage.dispose()
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
    // mounted once: the deck is a persistent object, its state is pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // transport state and artwork are pushed in, never re-mounted
  useEffect(() => { controllerRef.current?.setPlaying(playing) }, [playing])
  useEffect(() => { controllerRef.current?.setCover(cover) }, [cover])
  useEffect(() => { controllerRef.current?.setAccent(accent) }, [accent])
  useEffect(() => { controllerRef.current?.setPaused(paused) }, [paused])

  if (failed) {
    return (
      <div className={className}>
        <Turntable phase="playing" recordIn spinning={playing} needleDropped={playing} labelUrl={cover} />
      </div>
    )
  }

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
    </div>
  )
}
