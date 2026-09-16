import * as THREE from 'three'
import { audio } from '../audio/engine'
import { buildStudioEnv, buildTurntable, ARM_PLAY_ANGLE, ARM_REST_ANGLE } from './turntable'

/**
 * The turntable as a *display piece*.
 *
 * The intro choreographs a shot; this is the same modelled deck, standing still
 * in the room and behaving like a machine that is simply there: the platter
 * turns while the transport is running and coasts down when it stops, the arm
 * is cued or resting, the label carries whatever album is on, and the level
 * bars answer the analyser. It is the home page's turntable, in other words the
 * same object the opening builds — not a picture of one.
 */

export interface DeckStageOptions {
  /** print this artwork on the label */
  cover?: string
  /** fall back to the MH mark when there is nothing on the platter */
  playing?: boolean
  accent?: string
}

export interface DeckStageController {
  resize(width: number, height: number, dpr: number): void
  setPlaying(on: boolean): void
  setCover(url?: string): void
  setAccent(hex?: string): void
  /** stop drawing while the deck is off-screen or behind the full player */
  setPaused(on: boolean): void
  dispose(): void
  debug: Record<string, unknown>
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function createDeckStage(renderer: THREE.WebGLRenderer, opts: DeckStageOptions = {}): DeckStageController {
  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40)
  camera.position.set(1.05, 1.18, 1.95)

  const envTex = buildStudioEnv(renderer)
  scene.environment = envTex

  const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x05060a, 0.5)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xcfe0ff, 2.5)
  key.position.set(-2.2, 3.2, 2.0)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xffa860, 1.0)
  rim.position.set(3.0, 1.2, -2.6)
  scene.add(rim)

  const glow = new THREE.PointLight(0x9fd8ff, 0.9, 3.4, 2)
  glow.position.set(-0.24, 0.34, 0.1)
  scene.add(glow)

  // No floor and no shadow catcher: the deck is presented on its own, floating
  // over whatever the page puts behind it. The canvas is transparent, so
  // anything drawn in here would read as a backdrop rather than as the object.
  const deck = buildTurntable()
  deck.root.position.y = -0.06
  scene.add(deck.root)

  if (opts.cover) deck.setLabelCover(opts.cover)
  let playing = !!opts.playing
  if (opts.accent) {
    const c = new THREE.Color(opts.accent)
    deck.accent.color.copy(c)
    deck.accent.emissive.copy(c).multiplyScalar(0.5)
    glow.color.copy(c)
  }

  /* ── pointer parallax: the deck is an object, so it moves like one ───── */
  let px = 0, py = 0, tpx = 0, tpy = 0
  const onMove = (e: PointerEvent) => {
    tpx = (e.clientX / window.innerWidth - 0.5) * 2
    tpy = (e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  /* ── the machine's own state ─────────────────────────────────────────── */
  let spin = 0
  let vel = 0
  let armPos = 0
  let time = 0
  let bass = 0
  let paused = false

  const off = audio.onFrame((l, dtRaw) => {
    const dt = Math.min(0.05, dtRaw)
    // the transport state is cheap to keep in sync; the draw is not, so the
    // deck stops rendering the moment it leaves the screen
    time += dt
    bass += (l.bass - bass) * Math.min(1, dt * 4)

    // spin up quickly, coast down slowly — the same inertia as the dock's record
    const want = playing ? 1.15 + l.energy * 0.5 : 0
    vel += (want - vel) * Math.min(1, dt * (playing ? 2.2 : 0.9))
    spin += dt * vel
    deck.platter.rotation.y = spin

    // the arm is cued when the record is on, lifted when it is not
    const armWant = playing ? 1 : 0
    armPos += (armWant - armPos) * Math.min(1, dt * 1.6)
    deck.arm.rotation.y = ARM_REST_ANGLE + (ARM_PLAY_ANGLE - ARM_REST_ANGLE) * armPos
    deck.arm.rotation.z = -armPos * 0.05 + (1 - armPos) * 0.012
    deck.arm.position.y = 0.16 + (1 - armPos) * 0.12

    deck.led.emissiveIntensity = 0.2 + armPos * (1.6 + bass * 2.2)
    glow.intensity = 0.5 + armPos * (1.0 + bass * 2.6)
    deck.vu.forEach((m, i) => {
      const w = 0.5 + 0.5 * Math.sin(time * (5.0 + i * 0.8) + i) * (0.4 + bass)
      m.emissiveIntensity = 0.15 + armPos * (0.7 + w * 2.4)
      m.emissive.setHSL(0.53 - (i / 6) * 0.09, 0.8, 0.5 + clamp01(w) * 0.2)
    })

    if (paused) return

    px += (tpx - px) * Math.min(1, dt * 2.4)
    py += (tpy - py) * Math.min(1, dt * 2.4)

    // a slow idle turn plus the parallax: it reads as a solid object at rest.
    // The deck is held slightly left of its frame's centre so it sits close to
    // the sleeve the page puts beside it — the extra room lands on the right,
    // next to the arm, where empty space costs nothing.
    const idle = Math.sin(time * 0.18) * 0.05
    camera.position.set(
      1.14 + px * 0.15 + idle,
      1.14 - py * 0.10,
      1.90 - Math.abs(px) * 0.05,
    )
    camera.lookAt(0.06, 0.06 - py * 0.02, 0)

    renderer.render(scene, camera)
  })

  const resize = (width: number, height: number, dpr: number) => {
    camera.aspect = Math.max(0.2, width / Math.max(1, height))
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
  }

  return {
    resize,
    setPlaying(on) { playing = on },
    setCover(url) { deck.setLabelCover(url) },
    setPaused(on) { paused = on },
    setAccent(hex) {
      const c = new THREE.Color(hex ?? '#9fd8ff')
      deck.accent.color.copy(c)
      deck.accent.emissive.copy(c).multiplyScalar(0.5)
      glow.color.copy(c)
    },
    debug: { scene, camera, deck, renderer },
    dispose() {
      off()
      window.removeEventListener('pointermove', onMove)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        const geo = m.geometry as THREE.BufferGeometry | undefined
        geo?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      envTex.dispose()
      renderer.dispose()
    },
  }
}
