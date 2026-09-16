import { useEffect, useRef } from 'react'
import { audio, type Levels } from '../audio/engine'
import { useSettingsStore } from '../stores/settings'
import { useReducedMotion } from '../hooks/useMedia'
import { rgba } from '../lib/color'
import { cn } from '../lib/format'

interface Star { x: number; y: number; z: number; tw: number; sp: number }
interface Node { x: number; y: number; vx: number; vy: number; r: number; e: number }
interface Ripple { x: number; y: number; r: number; max: number; life: number; hue: string }
interface Shooter { x: number; y: number; vx: number; vy: number; life: number; max: number }

function palette() {
  const cs = getComputedStyle(document.documentElement)
  return {
    accent: cs.getPropertyValue('--c-accent').trim() || '#6f8cff',
    accent2: cs.getPropertyValue('--c-accent-2').trim() || '#9ee8ff',
    deep: cs.getPropertyValue('--c-deep-0').trim() || '#06070c',
  }
}

/**
 * AmbientStage — the living space behind the player.
 * One canvas paints: a parallax starfield, a drifting molecule network that
 * lights up on beats, expanding beat ripples and a low bass waveform ribbon.
 * All motion is driven by the shared audio frame loop, so it breathes with
 * the music instead of running on a separate timer.
 */
export function AmbientStage({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animations = useSettingsStore((s) => s.settings.animations)
  const ambient = useSettingsStore((s) => s.settings.ambientStage)
  const street = useSettingsStore((s) => s.settings.streetTexture)
  const reduced = useReducedMotion()

  useEffect(() => {
    // `paused` lets the intro own the frame budget: no point painting a
    // starfield behind an opaque opening sequence
    if (!animations || reduced || !ambient || paused) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const g = ctx

    let w = innerWidth, h = innerHeight
    const dpr = Math.min(1.6, window.devicePixelRatio || 1)
    const resize = () => {
      w = innerWidth; h = innerHeight
      cv.width = w * dpr; cv.height = h * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // ── parallax pointer ────────────────────────────────────────────────────
    let mx = 0, my = 0, tmx = 0, tmy = 0
    const onMove = (e: PointerEvent) => {
      tmx = (e.clientX / w - 0.5) * 2
      tmy = (e.clientY / h - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    // ── scene construction (scaled to viewport) ─────────────────────────────
    const area = w * h
    const STAR_N = Math.round(Math.min(320, Math.max(110, area / 6800)))
    const NODE_N = Math.round(Math.min(52, Math.max(20, area / 52000)))

    const stars: Star[] = Array.from({ length: STAR_N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.15 + Math.random() * 0.85,
      tw: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 1.6,
    }))
    const nodes: Node[] = Array.from({ length: NODE_N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7,
      r: 0.6 + Math.random() * 0.9,
      e: 0,
    }))
    const ripples: Ripple[] = []
    const shooters: Shooter[] = []
    let nextShooter = performance.now() + 4000 + Math.random() * 6000

    const levels: Levels = { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, vol: 0.8, freq: null, wave: null }
    let lastBeat = 0

    const off = audio.onFrame((l, dt) => {
      levels.bass = l.bass; levels.mid = l.mid; levels.treble = l.treble
      levels.energy = l.energy; levels.beat = l.beat
      step(l, dt)
    })

    function step(l: Levels, dtRaw: number) {
      const dt = Math.min(0.05, dtRaw)
      const now = performance.now()
      const pal = palette()

      // smooth parallax
      mx += (tmx - mx) * Math.min(1, dt * 3)
      my += (tmy - my) * Math.min(1, dt * 3)

      g.clearRect(0, 0, w, h)

      // ── stars ─────────────────────────────────────────────────────────────
      const starBoost = 0.55 + l.treble * 0.6 + l.energy * 0.4
      for (const s of stars) {
        s.tw += dt * (0.5 + s.sp * 0.6)
        s.x -= dt * 3.2 * s.z
        if (s.x < -4) { s.x = w + 4; s.y = Math.random() * h }
        const px = s.x - mx * 16 * s.z
        const py = s.y - my * 10 * s.z + Math.sin(s.tw * 0.6) * 2.4 * s.z
        const a = (0.18 + Math.abs(Math.sin(s.tw)) * 0.62) * (0.4 + s.z * 0.8) * starBoost
        g.globalAlpha = Math.min(1, a)
        g.fillStyle = s.z > 0.78 ? pal.accent2 : '#dfe9ff'
        const size = s.z > 0.9 ? 2 : s.z * 1.5
        g.fillRect(px, py, size, size)
      }

      // ── molecule network (faint texture, not decoration) ──────────────────
      for (const n of nodes) {
        n.x += n.vx * dt
        n.y += n.vy * dt
        if (n.x < -30) n.x = w + 30; else if (n.x > w + 30) n.x = -30
        if (n.y < -30) n.y = h + 30; else if (n.y > h + 30) n.y = -30
        n.e = Math.min(1, Math.max(0, n.e - dt * 1.8) + l.beat * 0.22)
      }
      const linkDist = 104 + l.bass * 40
      g.lineWidth = 0.6
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        const ax = a.x - mx * 26
        const ay = a.y - my * 16
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 > linkDist * linkDist) continue
          const d = Math.sqrt(d2)
          const alpha = (1 - d / linkDist) * (0.05 + l.mid * 0.07 + (a.e + b.e) * 0.05)
          g.globalAlpha = Math.min(0.2, alpha)
          g.strokeStyle = pal.accent
          g.beginPath()
          g.moveTo(ax, ay)
          g.lineTo(b.x - mx * 26, b.y - my * 16)
          g.stroke()
        }
      }
      for (const n of nodes) {
        const px = n.x - mx * 26
        const py = n.y - my * 16
        g.globalAlpha = Math.min(0.5, 0.1 + l.mid * 0.12 + n.e * 0.22)
        g.fillStyle = n.e > 0.3 ? pal.accent2 : pal.accent
        g.beginPath()
        g.arc(px, py, n.r + n.e * 0.7, 0, Math.PI * 2)
        g.fill()
      }

      // ── beat ripples (music emanating into the room) ───────────────────────
      if (l.beat > 0.85 && now - lastBeat > 200) {
        lastBeat = now
        ripples.push({
          x: w / 2 + (Math.random() - 0.5) * w * 0.22,
          y: h * 0.42 + (Math.random() - 0.5) * h * 0.3,
          r: 10,
          max: 180 + l.bass * 320,
          life: 0,
          hue: Math.random() < 0.35 ? pal.accent2 : pal.accent,
        })
        if (ripples.length > 14) ripples.shift()
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.life += dt
        r.r += (r.max - r.r) * Math.min(1, dt * 1.6)
        const a = Math.max(0, 1 - r.life / 2.2)
        if (a <= 0) { ripples.splice(i, 1); continue }
        g.globalAlpha = a * 0.24
        g.strokeStyle = r.hue
        g.lineWidth = 1 + a * 1.6
        g.beginPath()
        g.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        g.stroke()
      }

      // ── shooting stars (street-light streaks) ─────────────────────────────
      if (now > nextShooter) {
        nextShooter = now + 7000 + Math.random() * 12000
        const fromLeft = Math.random() < 0.5
        shooters.push({
          x: fromLeft ? -60 : w + 60,
          y: Math.random() * h * 0.55,
          vx: (fromLeft ? 1 : -1) * (520 + Math.random() * 420),
          vy: 120 + Math.random() * 120,
          life: 0,
          max: 1.1 + Math.random() * 0.6,
        })
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i]
        s.life += dt
        if (s.life > s.max) { shooters.splice(i, 1); continue }
        s.x += s.vx * dt
        s.y += s.vy * dt
        const a = Math.sin((s.life / s.max) * Math.PI) * 0.7
        const glow = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.16, s.y - s.vy * 0.16)
        glow.addColorStop(0, rgba(pal.accent2, a))
        glow.addColorStop(1, 'transparent')
        g.globalAlpha = 1
        g.strokeStyle = glow
        g.lineWidth = 1.6
        g.beginPath()
        g.moveTo(s.x, s.y)
        g.lineTo(s.x - s.vx * 0.16, s.y - s.vy * 0.16)
        g.stroke()
      }

      // ── bass ribbon along the floor ───────────────────────────────────────
      const bandAlpha = 0.1 + l.energy * 0.4
      if (bandAlpha > 0.03) {
        const baseY = h - 46
        const amp = 6 + l.bass * 34
        g.globalAlpha = bandAlpha
        const grad = g.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, rgba(pal.accent, 0))
        grad.addColorStop(0.5, pal.accent2)
        grad.addColorStop(1, rgba(pal.accent, 0))
        g.strokeStyle = grad
        g.lineWidth = 1.2
        g.beginPath()
        for (let x = 0; x <= w; x += 12) {
          const t = x / w
          const y = baseY
            + Math.sin(t * 9 + now / 900) * amp * (0.4 + l.mid)
            + Math.sin(t * 23 + now / 420) * amp * 0.35 * l.treble
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y)
        }
        g.stroke()
      }

      g.globalAlpha = 1
    }

    return () => {
      off()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [animations, reduced, ambient, paused])

  return (
    <div className="stage-base" aria-hidden="true">
      <div className="stage-aurora" />
      <div className="stage-blob a drift-a" />
      <div className="stage-blob b drift-b" />
      <div className="stage-blob c drift-c" />
      {ambient && !reduced && <canvas ref={canvasRef} className="stage-canvas" />}
      {street && !reduced && <StreetLayer />}
      <div className="stage-vignette" />
      <div className="grain" />
    </div>
  )
}

/**
 * Street texture: the city outside the record shop. Halftone spray, stencil
 * marks and tape were here first; the skyline, neon, posters and gear were
 * added so the room has a place, not just a colour. Everything is faint, sits
 * at the edges, and is tinted by the album's accent so it changes with the
 * record — atmosphere, never content.
 *
 * Exported because the console renders its own copy *inside* the glass frame:
 * behind it the blur washes everything out to nothing.
 */
export function StreetLayer({ className }: { className?: string } = {}) {
  return (
    <div className={cn('street-layer', className)}>
      <div className="street-halftone" />
      <div className="street-spray" style={{ left: '-6%', top: '12%', width: '38vw', height: '38vw' }} />
      <div className="street-spray" style={{ right: '-10%', bottom: '4%', width: '44vw', height: '44vw', animationDelay: '-6s' }} />

      {/* the street itself, far behind everything */}
      <div className="st-skyline" />

      {/* neon over the shopfront */}
      <div className="st-neon" style={{ left: '6%', top: '14%', width: 132, height: 40 }} />
      <div className="st-neon" style={{ right: '8%', top: '30%', width: 96, height: 30, animationDelay: '-3.5s' }} />
      <div className="st-sign" style={{ left: '7.5%', top: '15.5%' }}>Records</div>

      {/* flyposters on the wall */}
      <div className="st-poster" style={{ right: '5%', top: '16%', width: 118, height: 158, transform: 'rotate(-2.5deg)' }} />
      <div className="st-poster" style={{ left: '3.5%', bottom: '16%', width: 96, height: 130, transform: 'rotate(3deg)' }} />

      {/* the gear in the corner */}
      <div className="st-speaker" style={{ right: '3.5%', bottom: '12%', transform: 'rotate(1.5deg)' }} />
      <div className="st-cassette" style={{ left: '11%', bottom: '26%', transform: 'rotate(-7deg)' }} />

      {/* stickers and scratches */}
      <div className="st-sticker" style={{ left: '22%', top: '22%', width: 34, height: 34, transform: 'rotate(14deg)' }} />
      <div className="st-sticker" style={{ right: '19%', bottom: '22%', width: 26, height: 26, transform: 'rotate(-18deg)' }} />
      <div className="st-sticker" style={{ left: '31%', bottom: '12%', width: 44, height: 20, transform: 'rotate(6deg)' }} />
      <div className="st-scratch" style={{ left: '16%', top: '38%', width: 120, transform: 'rotate(-8deg)' }} />
      <div className="st-scratch" style={{ right: '14%', top: '52%', width: 90, transform: 'rotate(5deg)' }} />

      <div className="street-stencil" style={{ left: '2.5vw', bottom: '11vh' }}>33⅓</div>
      <div className="street-stencil street-stencil-r" style={{ right: '2.5vw', top: '13vh' }}>SIDE A</div>
      <div className="street-tape" style={{ left: '50%', top: 0, transform: 'translateX(-50%) rotate(-1.2deg)' }} />
    </div>
  )
}
