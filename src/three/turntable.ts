import * as THREE from 'three'

/**
 * The MH Music turntable, modelled in code.
 *
 * Nothing here is an image of a deck: the plinth, platter, tonearm, cartridge,
 * knobs, glass lid and feet are real geometry shaded with physically-based
 * materials, lit by a procedurally built studio environment so the metal has
 * something to reflect. That is what lets the camera fly around it, and what
 * lets the pixel dissolve tear the actual object apart later.
 *
 * Built as a "futuristic artistic" deck rather than a copy of any real product:
 * matte piano-black body, brushed aluminium top plate, chrome arm, an accent
 * light strip and a floating glass lid.
 */

export interface TurntableParts {
  /** everything; move/rotate this to move the deck */
  root: THREE.Group
  /** the platter + record assembly, rotates about Y */
  platter: THREE.Group
  /** the disc itself — off the deck until it is lowered on */
  record: THREE.Group
  /** the tonearm, rotates about Y at the pivot */
  arm: THREE.Group
  /** the stylus tip, in world space of the deck */
  stylus: THREE.Object3D
  /** emissive accent strip, responds to playback */
  accent: THREE.MeshStandardMaterial
  /** status LED */
  led: THREE.MeshStandardMaterial
  /** the four level bars printed on the plinth */
  vu: THREE.MeshStandardMaterial[]
  /** glass lid, tilted open */
  lid: THREE.Group
  /** shockwave rings, played on the record landing and the stylus drop */
  ripples: THREE.Mesh[]
  /** every material we tint with the album accent */
  tintable: THREE.MeshStandardMaterial[]
  /** print the given artwork on the label; pass nothing to restore the MH mark */
  setLabelCover(url?: string): void
}

const BLACK = 0x0a0a0c
const METAL = 0xc8ccd4

/** A tiny studio: dark room, two soft box lights and one warm strip. The metal
 *  parts reflect this, which is where their realism comes from. */
export function buildStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene()

  const panel = (w: number, h: number, color: number, intensity: number, x: number, y: number, z: number, ry: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    )
    m.material.color.multiplyScalar(intensity)
    m.position.set(x, y, z)
    m.rotation.y = ry
    env.add(m)
  }

  // room shell (very dark, slightly blue)
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide }),
  ))
  // key light, high and camera-left, cool
  panel(7, 3.2, 0xbcd4ff, 2.6, -3.4, 4.6, -2.2, Math.PI * 0.28)
  // fill, low and camera-right, warm
  panel(5.4, 2.4, 0xffbf8a, 1.5, 4.2, 1.1, -1.4, -Math.PI * 0.34)
  // rim strip behind the deck
  panel(8, 0.5, 0x9fd8ff, 3.2, 0, 2.4, -5.2, 0)
  // faint floor bounce
  panel(12, 12, 0x1a1f2c, 0.5, 0, -2.6, 0, 0)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const rt = pmrem.fromScene(env, 0.04, 0.1, 100)
  pmrem.dispose()
  return rt.texture
}

/** Grooves, pressed into a canvas and mapped onto the disc. */
function grooveTexture(): THREE.CanvasTexture {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#08090c'
  g.fillRect(0, 0, S, S)

  const cx = S / 2, cy = S / 2
  // grooves: a dense band from just outside the label to the rim, plus the
  // run-out and lead-in gaps that make the surface readable when lit
  for (let r = S * 0.135; r < S * 0.492; r += 1.35) {
    const t = (r / S - 0.135) / 0.357
    g.strokeStyle = `rgba(${140 - t * 40}, ${148 - t * 42}, ${160 - t * 46}, ${0.05 + 0.1 * Math.random()})`
    g.lineWidth = 1
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.stroke()
  }
  // a soft sheen so the disc is never a flat black circle
  const sheen = g.createLinearGradient(0, 0, S, S)
  sheen.addColorStop(0, 'rgba(255,255,255,0.10)')
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.02)')
  sheen.addColorStop(0.7, 'rgba(255,255,255,0.06)')
  sheen.addColorStop(1, 'rgba(255,255,255,0.01)')
  g.fillStyle = sheen
  g.fillRect(0, 0, S, S)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** The centre label: MH Music's mark, printed like a record label. The canvas
 *  is kept so the label can be re-printed with the current album's artwork. */
function labelTexture(): { tex: THREE.CanvasTexture; draw: (cover?: HTMLImageElement) => void } {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!

  const mark = () => {
    const grd = g.createRadialGradient(S * 0.38, S * 0.34, 0, S * 0.5, S * 0.5, S * 0.62)
    grd.addColorStop(0, '#f4f7ff')
    grd.addColorStop(0.45, '#c9d4ea')
    grd.addColorStop(1, '#7d8aa6')
    g.fillStyle = grd
    g.fillRect(0, 0, S, S)

    g.strokeStyle = 'rgba(20,24,34,0.55)'
    g.lineWidth = 3
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2); g.stroke()

    g.fillStyle = 'rgba(16,19,28,0.9)'
    g.textAlign = 'center'
    g.font = '700 54px Inter, system-ui, sans-serif'
    g.fillText('MH', S / 2, S * 0.47)
    g.font = '600 22px Inter, system-ui, sans-serif'
    g.fillText('MUSIC', S / 2, S * 0.56)
    g.font = '500 16px Inter, system-ui, sans-serif'
    g.fillText('33⅓ RPM · SIDE A', S / 2, S * 0.65)
  }

  const draw = (cover?: HTMLImageElement) => {
    if (cover && cover.width) {
      // the artwork, centre-cropped to the label circle
      const side = Math.min(cover.width, cover.height)
      g.drawImage(
        cover,
        (cover.width - side) / 2, (cover.height - side) / 2, side, side,
        0, 0, S, S,
      )
      // the label still has to read as a label: a fine ring and the spindle
      g.strokeStyle = 'rgba(0,0,0,0.42)'
      g.lineWidth = 5
      g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); g.stroke()
    } else {
      mark()
    }
  }

  draw()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, draw: (cover) => { draw(cover); tex.needsUpdate = true } }
}

/** Brushed aluminium: fine anisotropic streaks, as a roughness map. */
function brushedRoughness(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#3a3a3a'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * S
    const v = 40 + Math.random() * 70
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.45})`
    g.lineWidth = Math.random() < 0.8 ? 1 : 2
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(S, y + (Math.random() - 0.5) * 2)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function buildTurntable(): TurntableParts {
  const root = new THREE.Group()
  const tintable: THREE.MeshStandardMaterial[] = []

  const brushed = brushedRoughness()
  const labelArt = labelTexture()

  const piano = new THREE.MeshStandardMaterial({ color: BLACK, metalness: 0.42, roughness: 0.22 })
  const body = new THREE.MeshStandardMaterial({ color: 0x121318, metalness: 0.55, roughness: 0.42 })
  const allum = new THREE.MeshStandardMaterial({
    color: METAL, metalness: 1, roughness: 0.34, roughnessMap: brushed,
  })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, metalness: 1, roughness: 0.09 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14151a, metalness: 0.1, roughness: 0.92 })
  const accent = new THREE.MeshStandardMaterial({
    color: 0x9fd8ff, emissive: 0x2a6c9a, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.35,
  })
  const led = new THREE.MeshStandardMaterial({
    color: 0xffd2a1, emissive: 0xff9a4d, emissiveIntensity: 0.2, roughness: 0.3,
  })
  tintable.push(accent, led)

  /* ── plinth: lower body, top plate, front lip, feet, accent strip ────── */
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.10, 1.12), body)
  bodyMesh.position.y = 0.05
  root.add(bodyMesh)

  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.045, 1.16), allum)
  plate.position.y = 0.118
  root.add(plate)

  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.03, 1.16), piano)
  lip.position.y = 0.028
  root.add(lip)

  // the accent strip runs along the front edge — the deck's signature light
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.012, 0.02), accent)
  strip.position.set(0, 0.145, 0.575)
  root.add(strip)

  for (const [x, z] of [[-0.72, -0.48], [0.72, -0.48], [-0.72, 0.48], [0.72, 0.48]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.05, 20), rubber)
    foot.position.set(x, -0.005, z)
    root.add(foot)
  }

  /* ── platter: heavy machined disc, strobe ring, spindle ─────────────── */
  const platter = new THREE.Group()
  platter.position.set(-0.24, 0.15, 0)
  root.add(platter)

  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.012, 72), piano)
  well.position.y = 0.006
  platter.add(well)

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.05, 72), allum)
  disc.position.y = 0.035
  platter.add(disc)

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.432, 0.014, 12, 96), chrome)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.06
  platter.add(rim)

  // strobe dots around the rim, so rotation is unmistakable
  const strobe = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.03, 0.006, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xdfe7f5, metalness: 0.9, roughness: 0.3 }),
    40,
  )
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    m4.makeRotationY(-a)
    m4.setPosition(Math.sin(a) * 0.405, 0.058, Math.cos(a) * 0.405)
    strobe.setMatrixAt(i, m4)
  }
  platter.add(strobe)

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 16), chrome)
  spindle.position.y = 0.085
  platter.add(spindle)

  /* ── the record: grooves, label, locked groove, so it reads as vinyl ── */
  const record = new THREE.Group()
  record.position.y = 0.075

  const vinyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.355, 0.355, 0.007, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0c0d10, metalness: 0.42, roughness: 0.24,
      map: grooveTexture(), envMapIntensity: 1.5,
    }),
  )
  record.add(vinyl)

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.118, 0.0085, 48),
    new THREE.MeshStandardMaterial({ map: labelArt.tex, metalness: 0.05, roughness: 0.55 }),
  )
  label.position.y = 0.0006
  record.add(label)

  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.011, 12), piano)
  hole.position.y = 0.001
  record.add(hole)
  platter.add(record)

  /* ── tonearm: the base is bolted down, only the arm swings ───────────── */
  // Two groups on the same vertical axis: `armBase` is the bearing housing,
  // bolted to the plinth and never moving, and `arm` carries the tube,
  // counterweight and headshell around that axis. On a real deck the pivot
  // housing is part of the chassis — seeing it swing with the arm was wrong.
  const PIVOT = new THREE.Vector3(0.60, 0.16, -0.02)

  const armBase = new THREE.Group()
  armBase.position.copy(PIVOT)
  root.add(armBase)

  const pivotBase = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.07, 28), allum)
  pivotBase.position.y = 0.035
  armBase.add(pivotBase)

  const pivotTop = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.05, 0.09, 24), chrome)
  pivotTop.position.y = 0.11
  armBase.add(pivotTop)

  // the anti-skate dial belongs to the housing, not to the moving arm
  const antiSkate = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.03, 20), allum)
  antiSkate.position.set(0, 0.235, 0.02)
  armBase.add(antiSkate)

  const arm = new THREE.Group()
  arm.position.copy(PIVOT)
  root.add(arm)

  // One tube through the bearing: it runs from the headshell end all the way
  // past the pivot to the counterweight, so the tail is visibly carried by the
  // housing instead of hanging in the air behind it.
  const ARM_LEN = 0.54
  const TAIL_LEN = 0.17
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.012, ARM_LEN + TAIL_LEN, 18),
    chrome,
  )
  tube.rotation.x = Math.PI / 2
  tube.position.set(0, 0.145, (TAIL_LEN - ARM_LEN) / 2)
  arm.add(tube)

  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.075, 24), piano)
  counter.rotation.x = Math.PI / 2
  counter.position.set(0, 0.145, 0.125)
  arm.add(counter)

  // headshell + cartridge at the far end
  const head = new THREE.Group()
  head.position.set(0, 0.135, -ARM_LEN - 0.02)
  arm.add(head)

  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.12), allum)
  head.add(shell)

  const cart = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.03, 0.055), piano)
  cart.position.set(0, -0.022, -0.012)
  head.add(cart)

  const stylus = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0016, 0.03, 10), chrome)
  stylus.position.set(0, -0.05, -0.03)
  head.add(stylus)

  // the rest post sits exactly where the parked headshell comes to rest
  const armRest = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.075, 16), allum)
  armRest.position.set(0.29, 0.19, 0.42)
  root.add(armRest)

  /** rotation that puts the stylus on the record's outer groove */

  /* ── controls: two knobs, a pitch fader, buttons, level bars ────────── */
  const controls = new THREE.Group()
  controls.position.set(0.58, 0.145, 0.3)
  root.add(controls)

  const knobs: Array<[number, number]> = [[-0.11, 0.075], [0.11, 0.055]]
  for (const [kx, kr] of knobs) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(kr, kr * 1.06, 0.055, 28), allum)
    knob.position.set(kx, 0.028, 0)
    controls.add(knob)
    // the indicator line on top of each knob
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.058, 0.03), accent)
    cap.position.set(kx, 0.032, kr * 0.4)
    controls.add(cap)
  }

  const faderTrack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.03), piano)
  faderTrack.position.set(0, 0.006, 0.14)
  controls.add(faderTrack)
  const fader = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.042), chrome)
  fader.position.set(0.04, 0.028, 0.14)
  controls.add(fader)

  const vu: THREE.MeshStandardMaterial[] = []
  for (let i = 0; i < 6; i++) {
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x2a5d7a, emissive: 0x2f8fd0, emissiveIntensity: 0.15, roughness: 0.4,
    })
    vu.push(barMat)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.016), barMat)
    bar.position.set(-0.075 + i * 0.03, 0.004, -0.12)
    bar.scale.y = 1 + (i % 3) * 0.4
    controls.add(bar)
  }
  tintable.push(...vu)

  /* ── status LED, set into the front-right of the plate ─────────────── */
  const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.018, 18, 12), led)
  ledMesh.position.set(-0.72, 0.148, 0.42)
  root.add(ledMesh)

  /* ── glass lid: open, so it never hides the record ─────────────────── */
  const lid = new THREE.Group()
  lid.position.set(0, 0.16, -0.58)
  lid.rotation.x = -1.02
  root.add(lid)

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.014, 1.12),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfe9ff, metalness: 0.6, roughness: 0.06, transparent: true, opacity: 0.16,
      envMapIntensity: 1.6, side: THREE.DoubleSide,
    }),
  )
  glass.position.z = -0.56
  lid.add(glass)

  const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.02, 0.03), chrome)
  lidTrim.position.set(0, 0, -1.12)
  lid.add(lidTrim)

  /* ── shockwave rings, replayed on the landing and the stylus drop ───── */
  const ripples: THREE.Mesh[] = []
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 96),
      new THREE.MeshBasicMaterial({
        color: 0xbfe3ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(-0.24, 0.152, 0)
    ring.visible = false
    root.add(ring)
    ripples.push(ring)
  }

  return {
    root, platter, record, arm, stylus, accent, led, vu, lid, ripples, tintable,
    setLabelCover(url) {
      if (!url) { labelArt.draw(); return }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => labelArt.draw(img)
      img.onerror = () => labelArt.draw()
      img.src = url
    },
  }
}

export const ACCENT_REST = new THREE.Color(0x9fd8ff)

/** Where the arm sits when it is not on the record: aimed in over the deck's
 *  front-right, just clear of the record's edge, with the stylus pointing
 *  inward. Derived from the layout above — do not hand-tune it separately from
 *  the pivot and arm length or the two will drift apart. */
export const ARM_REST_ANGLE = 2.534

/** How far the arm swings from its rest position to the record's first groove. */
export const ARM_PLAY_ANGLE = Math.PI / 2
