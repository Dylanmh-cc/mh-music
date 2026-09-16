import * as THREE from 'three'
import { buildStudioEnv, buildTurntable, ARM_PLAY_ANGLE, ARM_REST_ANGLE, type TurntableParts } from './turntable'

/**
 * The MH Music opening: one continuous shot of the turntable, and nothing else.
 *
 * There are no particles, no star field, no pixel treatment and no post
 * processing — the canvas is transparent and the only thing drawn into it is
 * the machine itself. What carries the shot is the choreography and the light:
 *
 *   1  the deck emerges out of black, camera pushing in
 *   2  dolly closer on the empty platter
 *   3  a record slides in and settles, with the platter settling under it
 *   4  the platter spins up, the arm swings over, the stylus drops, the LED and
 *      the level bars come alive
 *   5  the deck plays for a beat, then the lights have come down far enough that
 *      the shot can simply fade into the product
 *
 * The material work is all in `three/turntable`: modelled geometry under a
 * procedurally built studio environment, which is where the metal and the
 * glass get something to reflect.
 */

export interface IntroOptions {
  onLeaving?: () => void
  onDone?: () => void
  /** honour prefers-reduced-motion: a short fade instead of the full shot */
  reduced?: boolean
  accent?: string
}

export interface IntroController {
  resize(width: number, height: number, dpr: number): void
  /** jump to the end of the shot */
  skip(): void
  dispose(): void
  /** live scene handles, for development inspection only */
  debug: Record<string, unknown>
}

/** the beat sheet, in seconds */
const TL = {
  emerge: [0.0, 1.00],
  dolly: [1.00, 1.75],
  record: [1.75, 2.70],
  play: [2.70, 3.70],
  /** the camera dives onto the record surface and the image pixelates */
  pixel: [3.70, 4.60],
  /** the pixelated close-up is held while the interface arrives through it */
  hold: [4.60, 5.20],
  handover: [5.20, 6.00],
} as const

const TOTAL = TL.handover[1]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t) }
const between = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export function createIntro(renderer: THREE.WebGLRenderer, opts: IntroOptions = {}): IntroController {
  const reduced = !!opts.reduced
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x05060a, 0.055)

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60)
  camera.position.set(0, 1.35, 3.2)

  /* ── the room the machine stands in ──────────────────────────────────── */
  const envTex = buildStudioEnv(renderer)
  scene.environment = envTex

  const hemi = new THREE.HemisphereLight(0x8fb4ff, 0x05060a, 0.35)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xbfd8ff, 2.4)
  key.position.set(-2.6, 3.4, 2.2)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 12
  key.shadow.camera.left = -2.4
  key.shadow.camera.right = 2.4
  key.shadow.camera.top = 2.4
  key.shadow.camera.bottom = -2.4
  key.shadow.bias = -0.0012
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xffa860, 1.15)
  rim.position.set(3.2, 1.4, -3.0)
  scene.add(rim)

  const under = new THREE.PointLight(0x9fd8ff, 0, 3.2, 2)
  under.position.set(-0.24, 0.34, 0.1)
  scene.add(under)

  // the floor exists only to catch the deck's contact shadow: it gives the
  // machine weight without becoming a backdrop
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.62, metalness: 0.2 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.045
  floor.receiveShadow = true
  scene.add(floor)

  /* ── the deck ────────────────────────────────────────────────────────── */
  const deck: TurntableParts = buildTurntable()
  deck.root.position.y = -0.06
  scene.add(deck.root)
  deck.root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
  })

  if (opts.accent) {
    const c = new THREE.Color(opts.accent)
    deck.accent.color.copy(c)
    deck.accent.emissive.copy(c).multiplyScalar(0.5)
    under.color.copy(c)
  }

  /* ── the pixel stage ─────────────────────────────────────────────────── */
  // One pass, one effect: the frame is quantised into square blocks as the
  // camera closes on the record. Nothing is torn apart, nothing flies away and
  // nothing is tinted — the shot simply resolves into pixels and the interface
  // arrives through them.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  })
  target.samples = 4            // MSAA: the deck's edges are clean until the quantiser takes them

  const postScene = new THREE.Scene()
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBlock: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uRes;
      uniform float uBlock;
      varying vec2 vUv;
      void main() {
        // uBlock is the cell size in device pixels, so the quantisation can
        // never overshoot into a negative cell count (which would collapse the
        // whole frame onto a single texel)
        vec2 cells = uRes / max(1.0, uBlock);
        vec2 uv = (floor(vUv * cells) + 0.5) / cells;
        gl_FragColor = vec4(texture2D(tDiffuse, uv).rgb, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  })
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat))

  /* ── timeline ────────────────────────────────────────────────────────── */
  // Timed against the wall clock, not against accumulated frame deltas: on a
  // slow device the shot drops frames rather than stretching past its length.
  let startedAt = 0
  let elapsed = 0
  let skipped = false
  let disposed = false
  let leftFired = false
  let doneFired = false
  let spin = 0

  const spinUp = (t: number) => {
    const playP = between(t, TL.play[0], TL.play[0] + 0.7)
    return smooth(playP) * 2.05 * (0.55 + playP * 0.45)
  }

  const fireLeaving = () => { if (!leftFired) { leftFired = true; opts.onLeaving?.() } }
  const fireDone = () => { if (!doneFired) { doneFired = true; opts.onDone?.() } }

  const update = (dtRaw: number, now: number) => {
    const dt = Math.min(0.05, dtRaw)
    if (!startedAt) startedAt = now
    // The wall clock drives the shot even after a skip: skipping rebases the
    // start time instead of freezing the timeline. Freezing it meant `elapsed`
    // could sit below the end forever, `onDone` never fired, and the overlay
    // stayed on screen swallowing every click.
    elapsed = (now - startedAt) / 1000
    if (elapsed >= TL.handover[0]) fireLeaving()
    if (elapsed >= TOTAL) fireDone()

    const t = elapsed
    const emerge = smooth(between(t, TL.emerge[0], TL.emerge[1]))
    const dolly = smooth(between(t, TL.dolly[0], TL.dolly[1]))
    const rec = smooth(between(t, TL.record[0], TL.record[1]))
    const dive = smooth(between(t, TL.pixel[0], TL.pixel[1]))

    /* ── camera: push in, settle, then close on the record surface ─────── */
    // The frame is centred on the machine's own mass — platter at -0.24, the
    // controls out at +0.58 — so the whole shot sits balanced rather than
    // drifting to one side. The dive steers the centre back onto the record.
    const targetX = 0.02 - dive * 0.22
    const camZ = 3.2 - emerge * 0.85 - dolly * 0.25 - dive * 1.05
    const camY = 1.35 - emerge * 0.4 - dolly * 0.12 - dive * 0.5
    const yaw = -0.42 + emerge * 0.26 + dolly * 0.1
    camera.position.set(targetX + Math.sin(yaw) * (2.1 - dive * 1.5), camY, camZ)
    camera.lookAt(targetX, 0.12 - dive * 0.06, 0)
    camera.fov = 38 + dive * 8
    camera.updateProjectionMatrix()

    // a whisper of hand-held drift keeps it from feeling synthetic
    if (!reduced) {
      camera.position.x += Math.sin(t * 1.7) * 0.012
      camera.position.y += Math.cos(t * 2.1) * 0.009
    }

    /* ── the machine ──────────────────────────────────────────────────── */
    deck.root.position.y = -0.06 + (1 - emerge) * -0.34
    deck.root.scale.setScalar(0.94 + emerge * 0.06)
    deck.lid.rotation.x = -1.02 - emerge * 0.06

    // the record arrives from screen-left, above the deck
    const settle = 1 - Math.pow(1 - rec, 2.2)
    deck.record.position.set(-1.75 * (1 - settle), 0.075 + 0.62 * (1 - settle), 0.55 * (1 - settle))
    deck.record.rotation.set(
      -0.42 * (1 - settle) * Math.cos(settle * 8),
      0.5 * (1 - settle),
      -0.9 * (1 - settle),
    )

    spin += dt * spinUp(t)
    deck.platter.rotation.y = spin

    // the arm waits at rest, swings over, then the stylus drops
    const swing = smooth(between(t, TL.play[0] + 0.12, TL.play[0] + 0.7))
    const drop = smooth(between(t, TL.play[0] + 0.4, TL.play[0] + 0.78))
    deck.arm.rotation.y = ARM_REST_ANGLE + (ARM_PLAY_ANGLE - ARM_REST_ANGLE) * swing
    deck.arm.rotation.z = -drop * 0.05 + (1 - drop) * 0.012
    deck.arm.position.y = 0.16 + (1 - drop) * 0.12

    // the machine's own light: LED, level bars, the glow under the platter
    // (there is no audio yet — the deck is warming up)
    const live = drop
    const pulse = 0.55 + 0.45 * Math.sin(t * 7.4)
    deck.led.emissiveIntensity = 0.2 + live * 2.2 * (0.6 + 0.4 * Math.sin(t * 5.1))
    under.intensity = live * (1.1 + pulse * 2.4)
    if (!opts.accent) {
      deck.accent.emissiveIntensity = 0.8 + live * 1.6
      under.color.setHex(0x9fd8ff)
    }
    deck.vu.forEach((m, i) => {
      const w = 0.5 + 0.5 * Math.sin(t * (5.2 + i * 0.7) + i)
      m.emissiveIntensity = 0.15 + live * (0.7 + w * 2.6)
      m.emissive.setHSL(0.53 - (i / 6) * 0.09, 0.8, 0.5 + w * 0.2)
    })

    // the pixel stage: blocks grow as the lens closes in, then hold
    postMat.uniforms.uBlock.value = 1 + dive * 13
    key.intensity = 2.4 * (0.25 + emerge * 0.75) * (1 - dive * 0.25)
    rim.intensity = 1.15 * (0.3 + emerge * 0.7)
    hemi.intensity = 0.35 * (0.2 + emerge * 0.8)
  }

  const render = () => {
    if (disposed) return
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(postScene, postCamera)
  }

  let raf = 0
  let last = performance.now()
  const loop = (now: number) => {
    if (disposed) return
    const dt = (now - last) / 1000
    last = now
    update(dt, now)
    render()
    raf = requestAnimationFrame(loop)
  }

  const resize = (width: number, height: number, dpr: number) => {
    camera.aspect = Math.max(0.2, width / Math.max(1, height))
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    target.setSize(Math.max(1, Math.floor(width * dpr)), Math.max(1, Math.floor(height * dpr)))
    postMat.uniforms.uRes.value.set(Math.max(1, Math.floor(width * dpr)), Math.max(1, Math.floor(height * dpr)))
  }

  // reduced motion: hold the machine and let the caller's cross-fade do the work
  if (reduced) {
    elapsed = TL.hold[1]
    key.intensity = 2.4
    render()
    setTimeout(() => { fireLeaving(); setTimeout(fireDone, 260) }, 420)
  } else {
    raf = requestAnimationFrame(loop)
  }

  return {
    resize,
    debug: { scene, camera, deck, renderer, postMat, get t() { return elapsed } },
    skip() {
      if (skipped) return
      skipped = true
      // rebase rather than jump: the shot carries on from the handover beat, so
      // the cross-fade still plays and the timeline is guaranteed to finish
      startedAt = performance.now() - TL.handover[0] * 1000
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
      postMat.dispose()
      target.dispose()
      envTex.dispose()
      renderer.dispose()
    },
  }
}
