import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_PALETTE, rgba } from '../../lib/color'

export type Phase = 'dark' | 'reveal' | 'drop' | 'cue' | 'playing' | 'dissolve' | 'exit'

/**
 * The ritual, tightened so the record goes on the platter right after the deck
 * appears: dark room → deck fades up with an empty platter → the record is
 * lowered on → the platter spins up and the arm cues → the needle drops with a
 * ripple → the room deconstructs into particles → the player takes over.
 */
const T = {
  reveal: 700,     // 1. the deck appears on its own — platter empty
  drop: 1300,      // 2. the record is lowered onto the platter
  cue: 2500,       // 3. the platter turns and the arm swings over
  playing: 3300,   //    needle down, the record is playing
  dissolve: 4300,  // 4. the room deconstructs into particles
  exit: 5600,      // 5. the player takes over
}

/* ── deck geometry ─────────────────────────────────────────────────────────
   Everything below is expressed in one square frame (`.intro-sq`) where 1 unit
   is 1% of the deck width on BOTH axes, so the platter and the tonearm share a
   single coordinate system. The platter and the arm's parked/hovering angles
   keep the original look; only the arm's LENGTH is derived, from its pivot and
   the point where the stylus must meet the record — which is what keeps the
   needle lined up. Rotating the arm to `arm.onRecord` puts the tip exactly on
   `contact`. */
const PLATTER = { x: 6.5, y: 25.3, size: 46 }
const RECORD = 0.82                       // record diameter ÷ platter diameter
const CONTACT = { angle: -18, radius: 0.72 }  // where the stylus meets the groove
const PIVOT = { x: 74, y: 18 }
const ARM_REST_DEG = 100
const ARM_CUE_DEG = 122
/** height of each part above the deck surface, in the deck's own 3D space */
const Z = { platter: 0, record: 4, armRest: 30, armCue: 16, armDown: 8 }

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

const PLATTER_CENTRE = { x: PLATTER.x + PLATTER.size / 2, y: PLATTER.y + PLATTER.size / 2 }
const RECORD_R = (PLATTER.size * RECORD) / 2
const contact = {
  x: PLATTER_CENTRE.x + Math.cos(rad(CONTACT.angle)) * RECORD_R * CONTACT.radius,
  y: PLATTER_CENTRE.y + Math.sin(rad(CONTACT.angle)) * RECORD_R * CONTACT.radius,
}
const armLength = Math.hypot(contact.x - PIVOT.x, contact.y - PIVOT.y)
const angleToContact = deg(Math.atan2(contact.y - PIVOT.y, contact.x - PIVOT.x))
const restPost = {
  x: PIVOT.x + Math.cos(rad(ARM_REST_DEG)) * armLength,
  y: PIVOT.y + Math.sin(rad(ARM_REST_DEG)) * armLength,
}

const DECK_VARS = {
  '--platter-x': `${PLATTER.x}%`,
  '--platter-y': `${PLATTER.y}%`,
  '--platter-size': `${PLATTER.size}%`,
  '--record-scale': RECORD,
  '--arm-x': `${PIVOT.x}%`,
  '--arm-y': `${PIVOT.y}%`,
  '--arm-l': `${armLength}%`,
  '--rest-x': `${restPost.x}%`,
  '--rest-y': `${restPost.y}%`,
  '--z-platter': `${Z.platter}px`,
  '--z-record': `${Z.record}px`,
} as React.CSSProperties

export function IntroSequence({ onDone, onLeaving }: { onDone: () => void; onLeaving?: () => void }) {
  const [phase, setPhase] = useState<Phase>('dark')
  const timers = useRef<number[]>([])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const doneRef = useRef(onDone)
  const leavingRef = useRef(onLeaving)
  doneRef.current = onDone
  leavingRef.current = onLeaving
  const announced = useRef(false)

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }
  /** tell the shell to start revealing itself while we fade, so the handover
      is a cross-fade instead of a black gap */
  const announceLeaving = () => {
    if (announced.current) return
    announced.current = true
    leavingRef.current?.()
  }

  useEffect(() => {
    later(T.reveal, () => setPhase('reveal'))
    later(T.drop, () => setPhase('drop'))
    later(T.cue, () => setPhase('cue'))
    later(T.playing, () => setPhase('playing'))
    later(T.dissolve, () => { setPhase('dissolve'); announceLeaving() })
    later(T.exit, () => { setPhase('exit'); doneRef.current() })
    return clear
  }, [])

  const skip = () => {
    if (phase === 'dissolve' || phase === 'exit') return
    clear()
    setPhase('dissolve')
    announceLeaving()
    later(1000, () => { setPhase('exit'); doneRef.current() })
  }

  const spinning = phase === 'playing' || phase === 'dissolve' || phase === 'exit'
  const needleDropped = spinning
  const leaving = phase === 'dissolve' || phase === 'exit'
  const recordIn = phase !== 'dark' && phase !== 'reveal'

  // ── particle dissolve ───────────────────────────────────────────────────
  // Buffers are allocated once up front and reused, so entering the dissolve
  // phase never triggers a big allocation (which used to drop frames).
  const pool = useMemo(() => {
    const N = 3400
    const x = new Float32Array(N), y = new Float32Array(N)
    const vx = new Float32Array(N), vy = new Float32Array(N)
    const life = new Float32Array(N), max = new Float32Array(N)
    const size = new Float32Array(N)
    const hue = new Float32Array(N)         // 0..1, each grain keeps its own colour
    const fromDisc = new Uint8Array(N)      // 1 = starts on the record's grooves
    return { N, x, y, vx, vy, life, max, size, hue, fromDisc }
  }, [])

  useEffect(() => {
    if (phase !== 'dissolve') return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, devicePixelRatio || 1)
    const W = innerWidth, H = innerHeight
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cx = W / 2
    const cy = H * 0.46
    const R = Math.min(W, H) * 0.2
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || DEFAULT_PALETTE.primary
    const p = pool

    // Fine grains: the record's grooves go first as a dense coloured ring, then
    // the whole frame lifts away as a scatter of dust.
    const discCount = Math.round(p.N * 0.46)
    for (let i = 0; i < p.N; i++) {
      const onDisc = i < discCount
      if (onDisc) {
        const ang = Math.random() * Math.PI * 2
        const rr = R * (0.18 + Math.pow(Math.random(), 0.6) * 0.95)
        const sp = 18 + Math.random() * 150
        p.x[i] = cx + Math.cos(ang) * rr
        p.y[i] = cy + Math.sin(ang) * rr
        p.vx[i] = -Math.cos(ang) * sp + (Math.random() - 0.5) * 38
        p.vy[i] = -Math.sin(ang) * sp + (Math.random() - 0.5) * 38 - 6
        p.max[i] = 1.0 + Math.random() * 1.2
      } else {
        const x = Math.random() * W
        const y = Math.random() * H
        const ang = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.8
        const sp = 30 + Math.random() * 220
        p.x[i] = x
        p.y[i] = y
        p.vx[i] = -Math.cos(ang) * sp
        p.vy[i] = -Math.sin(ang) * sp * 0.6 - 8
        p.max[i] = 0.9 + Math.random() * 1.4
      }
      // delicate: small, bright, and every grain its own colour
      p.size[i] = 0.35 + Math.random() * 0.85
      p.hue[i] = Math.random()
      p.fromDisc[i] = onDisc ? 1 : 0
      p.life[i] = 0
    }

    // “晕染” — a handful of soft coloured washes that bloom outward and fade
    interface Bloom { x: number; y: number; r: number; grow: number; life: number; max: number; sprite: number }
    const bloomSprites = Array.from({ length: 8 }, () => {
      const h = Math.random() * 360
      return spriteFor(h, 78 + Math.random() * 20, 60 + Math.random() * 14)
    })
    const blooms: Bloom[] = Array.from({ length: 16 }, (_, i) => {
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.5
      const rr = R * (0.6 + Math.random() * 1.4)
      return {
        x: cx + Math.cos(ang) * rr,
        y: cy + Math.sin(ang) * rr * 0.8,
        r: 40 + Math.random() * 60,
        grow: -(150 + Math.random() * 300),
        life: -Math.random() * 0.5,
        max: 1.8 + Math.random() * 1.2,
        sprite: (Math.random() * bloomSprites.length) | 0,
      }
    })
    const accentSprite = spriteFor(0, 0, 0, accent)

    let raf = 0
    let last = performance.now()
    const t0 = last
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) || 0.016
      last = now
      const t = (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // the coloured washes first, so the grains read as sitting inside them
      for (const b of blooms) {
        b.life += dt
        if (b.life < 0 || b.life > b.max) continue
        const k = b.life / b.max
        const a = Math.sin(Math.min(1, k) * Math.PI) * 0.32
        const rr = b.r + b.grow * k
        ctx.globalAlpha = a
        ctx.drawImage(bloomSprites[b.sprite], b.x - rr, b.y - rr, rr * 2, rr * 2)
      }

      for (let i = 0; i < p.N; i++) {
        p.life[i] += dt
        if (p.life[i] > p.max[i]) continue
        p.x[i] += p.vx[i] * dt
        p.y[i] += p.vy[i] * dt
        const drag = Math.pow(p.fromDisc[i] ? 0.35 : 0.5, dt)
        p.vx[i] *= drag
        p.vy[i] = p.vy[i] * drag
        const a = Math.max(0, 1 - p.life[i] / p.max[i])
        ctx.globalAlpha = a * 0.75
        ctx.fillStyle = hueColor(p.hue[i] * 360)
        ctx.fillRect(p.x[i], p.y[i], p.size[i], p.size[i])
      }

      // a soft bloom at the heart of the deck as the room gives way
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.2)
      bloom.addColorStop(0, rgba(accent, Math.max(0, 0.22 - t * 0.13)))
      bloom.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.5
      const rr = R * (0.9 + t * 1.6)
      ctx.drawImage(accentSprite, cx - rr, cy - rr, rr * 2, rr * 2)

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (t < 2.8) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, pool])

  // camera: slow dolly-in, tiny drift, gentle pull-back before the dissolve.
  // Only transform + opacity are animated here, so the whole rig stays a
  // composited layer and the phase changes never repaint the deck.
  const camera = {
    dark: { scale: 0.93, x: 0, y: 30, rotateZ: -0.6, opacity: 0 },
    reveal: { scale: 1, x: 0, y: 10, rotateZ: 0.25, opacity: 1 },
    drop: { scale: 1.05, x: -6, y: 0, rotateZ: -0.2, opacity: 1 },
    cue: { scale: 1.1, x: 6, y: -4, rotateZ: 0.15, opacity: 1 },
    playing: { scale: 1.04, x: 0, y: 0, rotateZ: 0, opacity: 1 },
    dissolve: { scale: 1.28, x: 0, y: 10, rotateZ: 0, opacity: 1 },
    exit: { scale: 1.32, x: 0, y: 10, rotateZ: 0, opacity: 1 },
  }[phase]

  return (
    <motion.div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{ background: 'radial-gradient(120% 90% at 50% 42%, #06070c 0%, #020204 70%)' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: phase === 'dissolve' ? 1.0 : 0.9, ease: 'easeInOut', delay: leaving ? 0.3 : 0 }}
      onClick={skip}
      role="presentation"
      aria-label="Vinyl intro animation — click to skip"
    >
      {/* room haze + volumetric beam (opacity only — no blur animation) */}
      <div className="intro-haze" />
      <motion.div
        className="intro-beam"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'dark' ? 0.14 : phase === 'reveal' ? 0.5 : 0.36 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />

      {/* camera rig */}
      <div className="absolute inset-0 grid place-items-center" style={{ perspective: '1500px' }}>
        <motion.div
          className="intro-rig"
          style={{ width: 'min(94vmin, 1040px)' }}
          animate={camera}
          transition={{ duration: phase === 'dissolve' || phase === 'exit' ? 1.4 : 1.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Turntable
            phase={phase}
            recordIn={recordIn}
            spinning={spinning}
            needleDropped={needleDropped}
          />
          <div className="intro-floor" />
        </motion.div>
      </div>

      {/* stage lighting: warm key from the left, cool fill from the right */}
      <div className="intro-key" />
      <div className="intro-rim" />

      {/* out-of-focus foreground: crate + desk edge give depth */}
      <div className="intro-fg intro-fg-left" />
      <div className="intro-fg intro-fg-bottom" />
      <div className="intro-vignette" />
      {/* grain stays still during the intro — an animated blend layer over the
          whole screen is one of the most expensive things we could run here */}
      <div className="grain grain-static" style={{ opacity: phase === 'dark' ? 0.05 : 0.08 }} />

      {/* dust motes — pure CSS, so they never wake the main thread */}
      {motets.map((d, i) => (
        <span
          key={i}
          className="intro-mote"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.s,
            height: d.s,
            ['--t' as any]: `${d.t}s`,
            ['--d' as any]: `${d.d}s`,
            ['--dx' as any]: `${d.dx}px`,
          }}
        />
      ))}

      {/* wordmark */}
      <motion.div
        className="absolute bottom-[9%] left-0 right-0 select-none text-center"
        initial={{ opacity: 0 }}
        animate={leaving ? { opacity: 0 } : { opacity: phase === 'dark' ? 0 : 0.7 }}
        transition={{ duration: 1.6, ease: 'easeOut', delay: phase === 'dark' ? 0.3 : 0 }}
        style={{ fontSize: 'min(2.1vmin, 13px)', color: 'rgba(233,240,255,0.9)', letterSpacing: '0.46em' }}
      >
        M H &nbsp;M U S I C
      </motion.div>

      <motion.button
        className="glass-soft absolute bottom-6 right-6 z-10 rounded-full px-4 py-2 text-[12px] tracking-wide"
        style={{ color: 'var(--c-ink-dim)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        onClick={(e) => { e.stopPropagation(); skip() }}
      >
        Skip Intro
      </motion.button>

      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[5]" style={{ width: '100%', height: '100%' }} />
    </motion.div>
  )
}

/** The turntable — plinth, machined platter, tonearm, controls.
 *
 *  Shared with the homepage, which parks it at the top of the page: there the
 *  deck is always cued (`recordIn`), `labelUrl` carries the cover of whatever
 *  album is playing, and the stylus is down whenever the transport is running.
 */
export function Turntable({ phase, recordIn, spinning, needleDropped, labelUrl }: {
  phase: Phase; recordIn: boolean; spinning: boolean; needleDropped: boolean
  labelUrl?: string
}) {
  const armTarget = needleDropped ? angleToContact : phase === 'cue' ? ARM_CUE_DEG : ARM_REST_DEG

  return (
    <div className="intro-deck">
      <div className="intro-plinth">
        <div className="intro-plinth-top" />
        <div className="intro-plinth-bevel" />
        <div className="intro-plinth-face" />

        {/* one square frame holds the platter and the arm, so their geometry
            can never drift apart */}
        <div className="intro-sq" style={DECK_VARS}>
          {/* platter well */}
          <div className="intro-platter">
            <div className="intro-platter-rim" />
            <div className="intro-platter-strobe" />
            <div className="intro-platter-inner" />
            <div className="intro-platter-rings" />
            <div className="intro-spindle" />
            <motion.div
              className="intro-platter-sheen"
              animate={{ rotate: spinning ? 360 : 10 }}
              transition={spinning ? { duration: 7, repeat: Infinity, ease: 'linear' } : { duration: 1.2 }}
            />

            {/* needle-drop ripple */}
            <motion.div
              className="intro-ripple"
              initial={{ opacity: 0, scale: 0.25 }}
              animate={needleDropped ? { opacity: [0, 0.85, 0], scale: [0.25, 1.9] } : { opacity: 0, scale: 0.25 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />

            {/* shadow the record throws as it comes down */}
            <motion.div
              className="intro-record-shadow"
              initial={{ opacity: 0, scale: 0.72 }}
              animate={recordIn ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.72 }}
              transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 1.1, delay: recordIn ? 0.2 : 0 }}
            />

            {/* the record — lowered onto the platter from above (translateZ is
                "up" out of the deck once the plinth is tilted) */}
            <motion.div
              className="intro-record-slot"
              initial={{ z: 380, y: '-9%', rotateX: -6, rotateZ: -7, scale: 0.95, opacity: 0 }}
              animate={recordIn
                ? { z: Z.record, y: '0%', rotateX: 0, rotateZ: 0, scale: 1, opacity: 1 }
                : { z: 380, y: '-9%', rotateX: -6, rotateZ: -7, scale: 0.95, opacity: 0 }}
              transition={{
                type: 'spring', stiffness: 120, damping: 17, mass: 1.05,
                opacity: { duration: 0.35 },
              }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={needleDropped ? { scale: [1, 1.012, 1] } : { scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <div className="intro-record">
                  <div className={`intro-record-disc ${spinning ? 'is-spinning' : ''}`}>
                    <div
                      className="intro-record-label"
                      style={labelUrl ? { backgroundImage: `url("${labelUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                      {!labelUrl && (
                        <>
                          <span className="track-stencil text-[9px]" style={{ letterSpacing: '0.2em' }}>MH MUSIC</span>
                          <span className="track-stencil text-[7px] opacity-70">33⅓ RPM</span>
                        </>
                      )}
                    </div>
                    {/* the label is the playing album's own art, screened the way
                        the rest of the player screens artwork */}
                    {labelUrl && <span aria-hidden="true" className="mh-halftone rounded-full" style={{ opacity: 0.34 }} />}
                  </div>
                  {/* specular highlight stays fixed while the disc turns */}
                  <div className="intro-record-sheen" />
                  <div className="intro-record-rim" />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* tonearm: pivot at the deck's top-right, stylus landing on the
              record's outer groove by construction (see the geometry above) */}
          <motion.div
            className="intro-arm"
            initial={{ rotate: ARM_REST_DEG, z: Z.armRest }}
            animate={{ rotate: armTarget, z: needleDropped ? Z.armDown : phase === 'cue' ? Z.armCue : Z.armRest }}
            transition={{ type: 'spring', stiffness: 52, damping: 14, mass: 1.15 }}
          >
            <div className="intro-arm-bar" />
            <div className="intro-arm-pivot" />
            <div className="intro-arm-counter" />
            <div className="intro-arm-head" />
            <div className="intro-stylus" />
          </motion.div>
          <div className="intro-arm-rest" />

          {/* controls: VU meter, speed buttons, pitch fader */}
          <div className="intro-controls">
            <div className={`intro-vu ${needleDropped ? 'is-live' : ''}`} aria-hidden="true">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="intro-speed">
              <i className={spinning ? 'is-on' : ''}>33</i>
              <i>45</i>
            </div>
          </div>
          <div className="intro-pitch"><i /></div>

          <div className="intro-etch">MH MUSIC · DIRECT DRIVE · MADE FOR LISTENING</div>
          <div className="intro-led" />
          <div className="intro-readout" />
        </div>
      </div>
    </div>
  )
}

const motets = Array.from({ length: 16 }, (_, i) => ({
  x: 8 + ((i * 59) % 86),
  y: 12 + ((i * 41) % 76),
  s: 1.6 + ((i * 17) % 4),
  t: 11 + (i % 6) * 2.4,
  d: (i % 8) * 0.9,
  dx: ((i % 5) - 2) * 14,
}))

/** `hsl()` for a 0..360 hue at a fixed vivid-but-soft tone. */
function hueColor(h: number): string {
  return `hsl(${h.toFixed(0)}, 82%, 68%)`
}

/** A cached soft colour disc, so the dissolve never builds gradients per frame. */
function spriteFor(h: number, s: number, l: number, solid?: string): HTMLCanvasElement {
  const size = 128
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  const mid = solid ?? `hsl(${h}, ${s}%, ${l}%)`
  grad.addColorStop(0, mid)
  grad.addColorStop(0.45, solid ? rgba(solid, 0.5) : `hsla(${h}, ${s}%, ${l}%, 0.5)`)
  grad.addColorStop(1, solid ? rgba(solid, 0) : `hsla(${h}, ${s}%, ${l}%, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}
