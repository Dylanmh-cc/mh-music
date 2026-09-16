import { useEffect, useRef } from 'react'
import { audio, type Levels } from '../../audio/engine'
import { useSettingsStore } from '../../stores/settings'
import { useReducedMotion } from '../../hooks/useMedia'
import { hexToHsl } from '../../lib/color'
import type { Palette, VisualizerMode } from '../../types/models'
import { VoxelLandscape } from './VoxelLandscape'

/**
 * The music visualiser.
 *
 * Eight modes, all drawn from the same analyser frame and the same album
 * palette, so switching between them changes the shape of the reaction but not
 * the visual language. `terrain` — the block landscape the player opens on — is
 * its own module; the rest live here.
 *
 * Everything is written to one Canvas 2D context by hand (typed arrays, a
 * fixed particle pool, no per-frame allocation) because this runs behind the
 * lyrics at 60fps and must never fight the audio thread.
 */
export function Visualizer({ mode, palette, className }: {
  mode: VisualizerMode; palette: Palette; className?: string
}) {
  if (mode === 'terrain') return <VoxelLandscape palette={palette} className={className} />
  return <AltVisualizer mode={mode} palette={palette} className={className} />
}

function AltVisualizer({ mode, palette, className }: {
  mode: VisualizerMode; palette: Palette; className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animations = useSettingsStore((s) => s.settings.animations)
  const density = useSettingsStore((s) => s.settings.visual.density)
  const sensitivity = useSettingsStore((s) => s.settings.visual.sensitivity)
  const reduced = useReducedMotion()

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !animations || reduced) return
    const g = cv.getContext('2d')
    if (!g) return

    let w = window.innerWidth, h = window.innerHeight
    const dpr = Math.min(1.7, window.devicePixelRatio || 1)
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const gain = 0.55 + sensitivity * 0.9
    const base = hexToHsl(palette.primary)
    const accent = hexToHsl(palette.accent)
    const hue = base[0]
    const hue2 = accent[0]

    /* ── pools ──────────────────────────────────────────────────────────── */
    const COUNT = density === 'low' ? 380 : density === 'medium' ? 620 : density === 'ultra' ? 1400 : 900
    const px = new Float32Array(COUNT)
    const py = new Float32Array(COUNT)
    const pz = new Float32Array(COUNT)   // 0..1 depth
    const ps = new Float32Array(COUNT)   // size
    const ph = new Float32Array(COUNT)   // hue jitter
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.pow(Math.random(), 0.6)
      px[i] = Math.cos(a) * r
      py[i] = Math.sin(a) * r
      pz[i] = Math.random()
      ps[i] = 0.6 + Math.random() * 2.2
      ph[i] = Math.random()
    }

    interface Ripple { r: number; life: number; hue: number }
    const ripples: Ripple[] = []

    interface Ring { y: number; seed: number }
    const ribbons: Ring[] = Array.from({ length: 6 }, (_, i) => ({ y: (i + 1) / 7, seed: i * 1.7 }))

    let t = 0
    let beatPulse = 0
    let lastBeat = 0
    let energy = 0

    const draw = (l: Levels, dt: number) => {
      t += dt
      energy += (l.energy - energy) * Math.min(1, dt * 3)
      const now = performance.now()
      if (l.beat > 0.62 && now - lastBeat > 170) {
        lastBeat = now
        beatPulse = 1
        if (mode === 'vinylWave') ripples.push({ r: 0.04, life: 1, hue: hue2 + Math.random() * 40 })
        if (ripples.length > 26) ripples.shift()
      }
      beatPulse *= Math.pow(0.0015, dt)

      g.clearRect(0, 0, w, h)
      const cx = w / 2, cy = h * 0.5
      const freq = l.freq
      const bins = freq ? freq.length : 64

      switch (mode) {
        /* ── Classic Waveform ─────────────────────────────────────────── */
        case 'waveform': {
          const wave = l.wave
          const amp = h * (0.10 + energy * 0.16 * gain)
          g.lineWidth = 2.4
          g.lineJoin = 'round'
          for (let pass = 0; pass < 2; pass++) {
            const glow = pass === 0
            g.strokeStyle = glow
              ? `hsla(${hue2}, 90%, 62%, ${0.16 + energy * 0.22})`
              : `hsl(${hue2}, 92%, ${62 + energy * 14}%)`
            g.lineWidth = glow ? 10 : 2.4
            g.beginPath()
            const N = wave ? wave.length : 128
            for (let i = 0; i < N; i++) {
              const v = wave ? (wave[i] - 128) / 128 : Math.sin(i * 0.2 + t * 2) * 0.3
              const x = (i / (N - 1)) * w
              const y = cy + v * amp
              if (i === 0) g.moveTo(x, y)
              else g.lineTo(x, y)
            }
            g.stroke()
          }
          // a mirrored ghost keeps it from floating in nowhere
          g.globalAlpha = 0.25
          g.scale(1, -1)
          g.translate(0, -cy * 2)
          g.strokeStyle = `hsl(${hue}, 70%, 50%)`
          g.lineWidth = 1.2
          g.stroke()
          g.setTransform(dpr, 0, 0, dpr, 0, 0)
          g.globalAlpha = 1
          break
        }

        /* ── Circular Spectrum ────────────────────────────────────────── */
        case 'circular': {
          const R = Math.min(w, h) * 0.19
          const N = 128
          g.save()
          g.translate(cx, cy)
          for (let i = 0; i < N; i++) {
            const b = freq ? freq[Math.floor((i / N) * bins * 0.72)] / 255 : 0
            const len = R * (0.16 + b * 1.5 * gain) + beatPulse * 6
            const a = (i / N) * Math.PI * 2 + t * 0.12
            g.rotate(0)
            const x0 = Math.cos(a) * R
            const y0 = Math.sin(a) * R
            const x1 = Math.cos(a) * (R + len)
            const y1 = Math.sin(a) * (R + len)
            g.strokeStyle = `hsla(${hue + (i / N) * (hue2 - hue || 40)}, 88%, ${52 + b * 26}%, ${0.35 + b * 0.6})`
            g.lineWidth = 2.2
            g.beginPath()
            g.moveTo(x0, y0)
            g.lineTo(x1, y1)
            g.stroke()
          }
          // inner core: a soft disc breathing with the bass
          const core = R * (0.62 + l.bass * 0.16)
          const grd = g.createRadialGradient(0, 0, 0, 0, 0, core)
          grd.addColorStop(0, `hsla(${hue2}, 90%, 68%, ${0.30 + energy * 0.3})`)
          grd.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = grd
          g.beginPath()
          g.arc(0, 0, core, 0, Math.PI * 2)
          g.fill()
          g.restore()
          break
        }

        /* ── Particles ────────────────────────────────────────────────── */
        case 'particles': {
          const spread = Math.min(w, h) * (0.42 + l.bass * 0.16 * gain)
          g.globalCompositeOperation = 'lighter'
          for (let i = 0; i < COUNT; i++) {
            // slow outward drift, pulled back in when the track is quiet
            const drift = 1 + dt * (0.05 + pz[i] * 0.10)
            px[i] *= drift
            py[i] *= drift
            if (px[i] * px[i] + py[i] * py[i] > 1.1) { px[i] *= 0.32; py[i] *= 0.32 }
            const x = cx + px[i] * spread
            const y = cy + py[i] * spread * 0.72
            const b = freq ? freq[Math.floor(ph[i] * bins * 0.5)] / 255 : 0
            const a = (0.18 + pz[i] * 0.5) * (0.4 + b * 0.9 + l.treble * 0.5)
            g.fillStyle = `hsla(${hue + ph[i] * ((hue2 - hue) || 50)}, 90%, ${58 + b * 24}%, ${Math.min(0.9, a)})`
            const s = ps[i] * (0.7 + pz[i] * 0.9) * (1 + beatPulse * 0.5)
            g.fillRect(x, y, s, s)
          }
          g.globalCompositeOperation = 'source-over'
          break
        }

        /* ── Vinyl Wave ───────────────────────────────────────────────── */
        case 'vinylWave': {
          const max = Math.hypot(w, h) * 0.62
          for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i]
            r.r += dt * (0.16 + energy * 0.3)
            r.life -= dt * 0.42
            if (r.life <= 0) { ripples.splice(i, 1); continue }
            g.strokeStyle = `hsla(${r.hue}, 88%, ${58 + energy * 18}%, ${r.life * 0.5})`
            g.lineWidth = 1.6 + r.life * 3.4
            g.beginPath()
            g.arc(cx, cy, r.r * max, 0, Math.PI * 2)
            g.stroke()
          }
          // the groove itself: a fine band whose radius breathes with the bass
          const R = Math.min(w, h) * (0.2 + l.bass * 0.045)
          for (let k = 0; k < 18; k++) {
            const rr = R * (0.55 + k * 0.028)
            g.strokeStyle = `hsla(${hue}, 60%, 60%, ${0.05 + (k / 18) * 0.05})`
            g.lineWidth = 1
            g.beginPath()
            g.arc(cx, cy, rr, 0, Math.PI * 2)
            g.stroke()
          }
          break
        }

        /* ── Galaxy ───────────────────────────────────────────────────── */
        case 'galaxy': {
          const arms = 2
          const R = Math.min(w, h) * (0.44 + l.bass * 0.05)
          g.globalCompositeOperation = 'lighter'
          for (let i = 0; i < COUNT; i++) {
            const arm = i % arms ? 0 : Math.PI
            const d = Math.pow(pz[i], 0.55)
            const a = arm + d * 3.4 + t * 0.09 + ph[i] * 0.16
            const rr = (0.12 + d) * R
            const x = cx + Math.cos(a) * rr
            const y = cy + Math.sin(a) * rr * 0.42
            const b = freq ? freq[Math.floor(d * bins * 0.6)] / 255 : 0
            const al = (0.10 + d * 0.5) * (0.45 + b * 0.8 + energy * 0.4)
            g.fillStyle = `hsla(${hue + d * ((hue2 - hue) || 60)}, 92%, ${56 + b * 26}%, ${Math.min(0.85, al)})`
            const s = ps[i] * (0.6 + d * 1.2)
            g.fillRect(x, y, s, s)
          }
          const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.34)
          core.addColorStop(0, `hsla(${hue2}, 92%, 74%, ${0.22 + energy * 0.28 + beatPulse * 0.2})`)
          core.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = core
          g.fillRect(cx - R * 0.4, cy - R * 0.4, R * 0.8, R * 0.8)
          g.globalCompositeOperation = 'source-over'
          break
        }

        /* ── Aurora ───────────────────────────────────────────────────── */
        case 'aurora': {
          g.globalCompositeOperation = 'lighter'
          for (const rib of ribbons) {
            const b = freq ? freq[Math.floor(rib.seed / 2 % 1 * bins * 0.5)] / 255 : 0.3
            const yTop = rib.y * h - h * 0.16
            g.beginPath()
            g.moveTo(0, h * 0.62)
            const segs = 26
            for (let i = 0; i <= segs; i++) {
              const x = (i / segs) * w
              const y = yTop
                + Math.sin(t * 0.35 + rib.seed + i * 0.28) * h * 0.055
                + Math.sin(t * 0.17 + i * 0.11) * h * 0.03
              g.lineTo(x, y)
            }
            g.lineTo(w, h * 0.78)
            g.lineTo(0, h * 0.78)
            g.closePath()
            const grd = g.createLinearGradient(0, yTop, 0, h * 0.78)
            grd.addColorStop(0, `hsla(${hue + rib.seed * 12}, 90%, 66%, ${0.10 + b * 0.22 + energy * 0.08})`)
            grd.addColorStop(1, 'rgba(0,0,0,0)')
            g.fillStyle = grd
            g.fill()
          }
          g.globalCompositeOperation = 'source-over'
          break
        }

        /* ── Minimal ──────────────────────────────────────────────────── */
        case 'minimal': {
          // one hairline of spectrum and a beat dot: nothing else moves
          const y = h * 0.5
          const bw = w / bins
          for (let i = 0; i < bins; i++) {
            const b = freq ? freq[i] / 255 : 0
            if (b < 0.04) continue
            g.fillStyle = `hsla(${hue2}, 60%, 70%, ${0.10 + b * 0.34})`
            g.fillRect(i * bw, y - b * h * 0.06, Math.max(1, bw - 2), b * h * 0.12)
          }
          g.fillStyle = `hsla(${hue2}, 90%, 72%, ${0.5 + beatPulse * 0.5})`
          g.beginPath()
          g.arc(cx, y, 2.6 + beatPulse * 2.4, 0, Math.PI * 2)
          g.fill()
          break
        }

        default:
          break
      }
    }

    const off = audio.onFrame((l, dtRaw) => draw(l, Math.min(0.05, dtRaw)))
    return () => {
      off()
      window.removeEventListener('resize', resize)
    }
  }, [mode, palette, animations, reduced, density, sensitivity])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
