import { useEffect, useRef } from 'react'
import { audio, type Levels } from '../../audio/engine'
import { useSettingsStore } from '../../stores/settings'
import { useReducedMotion } from '../../hooks/useMedia'
import { hexToHsl } from '../../lib/color'
import type { Palette } from '../../types/models'

/**
 * The music landscape — the player's only visualiser.
 *
 * A block terrain is raised out of a dark room by the track: the spectrum sets
 * the height of each column, the bass swells the whole island, and a ring of
 * blocks at the rim holds the shape like the glowing band in the reference. It
 * replaces the old particle field entirely.
 *
 * Layout is an isometric grid drawn back to front so the blocks occlude each
 * other; drawn frame by frame from the shared AudioReactiveEngine, with the
 * camera drifting slightly against the pointer.
 */
export function VoxelLandscape({ palette, className }: { palette: Palette; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animations = useSettingsStore((s) => s.settings.animations)
  const density = useSettingsStore((s) => s.settings.visual.density)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!animations || reduced) return
    const cv = canvasRef.current
    if (!cv) return
    const g = cv.getContext('2d')
    if (!g) return

    // grid resolution follows the density setting; wide and shallow, so the
    // result reads as a landscape rather than a city
    const res = density === 'low' ? 0.62 : density === 'medium' ? 0.8 : density === 'ultra' ? 1.3 : 1
    const COLS = Math.round(Math.min(56, Math.max(24, (window.innerWidth / 30) * res)))
    const ROWS = Math.round(Math.min(30, Math.max(14, (window.innerHeight / 40) * res)))

    let w = window.innerWidth, h = window.innerHeight
    const dpr = Math.min(1.6, window.devicePixelRatio || 1)
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let px = 0, py = 0, tpx = 0, tpy = 0
    const onMove = (e: PointerEvent) => {
      tpx = (e.clientX / w - 0.5) * 2
      tpy = (e.clientY / h - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    // ── the island's static shape ─────────────────────────────────────────
    // The ring is defined in *screen* space, not grid space: an isometric grid's
    // natural iso-distance is a diamond on screen, and a diamond rim reads as a
    // stray edge rather than the band around the island. `u`/`v` are the cell's
    // offsets along the two projected axes, so measuring them in pixels gives a
    // circular island with a circular rim however the grid is sliced.
    const N = COLS * ROWS
    const cxm = (COLS - 1) / 2, cym = (ROWS - 1) / 2
    const u = new Float32Array(N)
    const v = new Float32Array(N)
    const wob = new Float32Array(N)
    const inside = new Uint8Array(N)
    const rim = new Uint8Array(N)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        u[i] = (c - cxm) - (r - cym)
        v[i] = (c - cxm) + (r - cym)
        wob[i] = (Math.random() - 0.5) * 0.05
      }
    }

    const target = new Float32Array(N)
    const height = new Float32Array(N)
    let time = 0, lastBeatAt = 0, bassEnv = 0, beatPulse = 0
  // the palette is parsed once per album, not once per frame
  let paletteCache: { key: string; base: number[]; ringHue: number; ringSat: number } | null = null

    const off = audio.onFrame((l: Levels, dtRaw: number) => {
      const dt = Math.min(0.05, dtRaw)
      time += dt
      const now = performance.now()
      bassEnv += (l.bass - bassEnv) * Math.min(1, dt * 4)
      const onBeat = l.beat > 0.62 && now - lastBeatAt > 160
      if (onBeat) { lastBeatAt = now; beatPulse = 1 }
      beatPulse *= Math.pow(0.0015, dt)     // the kick decays the way the analyser's does

      px += (tpx - px) * Math.min(1, dt * 3)
      py += (tpy - py) * Math.min(1, dt * 3)

      const freq = l.freq
      const bins = freq ? freq.length : 64

      // ── projection (the island's radius is defined here too) ────────────
      const cell = Math.min(w / (COLS * 1.55), h / (ROWS * 1.5))
      const cw = cell * 1.5          // half-width of an iso tile
      const ch = cell * 0.6          // half-height (flat: this is terrain, not a city)
      const originX = w / 2 + px * 30
      // the island sits in the lower half of the frame: its tallest towers then
      // rise to about the middle of the screen, which is where the reference
      // puts the horizon, and the lyrics always have dark blocks behind them
      // The whole island rises and falls with the track: the bass lifts it, a
      // beat gives it a kick, and a slow swell keeps it breathing while the
      // music is quiet. Every block moves together, so the terrain reads as one
      // surface rather than a set of parts.
      const bob = bassEnv * h * 0.022 + beatPulse * h * 0.014 + Math.sin(time * 1.15) * h * 0.006
      const originY = h * 0.72 + py * 14 - bob
      const lift = h * 0.20          // how far a full-height column rises
      // The island is an ellipse measured in projected pixels: wide across the
      // frame and shallow front to back, which is what makes the rim read as the
      // banded ring around a landscape instead of a ring around a tower.
      const RX = (COLS / 2) * cw
      const RY = (ROWS / 2) * ch

      // ── how far the music pushes each column up ─────────────────────────
      for (let i = 0; i < N; i++) {
        // clamped at zero: the wobble can push the island's exact centre to a
        // tiny negative, and a negative base in Math.pow returns NaN, which
        // silently erases every polygon drawn from it
        const d = Math.max(0, Math.hypot((u[i] * cw) / RX, (v[i] * ch) / RY) + wob[i])
        inside[i] = d < 1 ? 1 : 0
        rim[i] = d >= 0.82 && d < 0.93 ? 1 : 0
        if (!inside[i]) { target[i] = 0; continue }
        const r = (i / COLS) | 0
        const dy = (r / (ROWS - 1)) * 2 - 1
        // low frequencies at the back of the island, highs at the front
        const band = freq ? freq[Math.min(bins - 1, Math.floor((1 - dy) * 0.5 * bins * 0.55))] / 255 : 0
        const fall = 1 - Math.pow(d, 1.8)                  // highest in the middle
        const swell = Math.sin(time * 0.5 - d * 4.6) * 0.5 + 0.5
        if (rim[i]) {
          // the ring keeps its own height, and lifts with the bass
          target[i] = 0.34 + bassEnv * 0.24 + (onBeat ? 0.04 : 0)
        } else {
          target[i] = Math.max(
            0.045,                                         // a solid floor, never a hole
            fall * (0.10 + band * 1.25 + bassEnv * 0.42) * (0.74 + swell * 0.38),
          )
        }
      }

      g.clearRect(0, 0, w, h)

      // One palette for the whole terrain: the rim is the same colour family as
      // the blocks it wraps, lifted in lightness so the ring reads without
      // introducing a second hue. Nothing here is off-palette. Parsing the two
      // hex values belongs outside the loop — it used to run 60 times a second.
      if (!paletteCache || paletteCache.key !== palette.primary + palette.accent) {
        paletteCache = {
          key: palette.primary + palette.accent,
          base: hexToHsl(palette.primary),
          ringHue: hexToHsl(palette.accent)[0],
          ringSat: Math.min(96, hexToHsl(palette.accent)[1] + 6),
        }
      }
      const { base, ringHue, ringSat } = paletteCache

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c
          height[i] += (target[i] - height[i]) * Math.min(1, dt * (target[i] > height[i] ? 11 : 4.5))
          const vh = height[i]
          if (vh < 0.012) continue

          const nx = u[i] * cw
          const sx = originX + nx
          // a gentle bow so the horizon curves away at the edges
          const sy = originY + v[i] * ch - vh * lift + Math.pow(nx / RX, 2) * h * 0.06
          const dep = vh * lift

          const t = Math.min(1, vh / 1.0)
          const hue = ringHue + (base[0] - ringHue) * (1 - t) * 0.35
          const sat = rim[i] ? ringSat : base[1]
          const L = rim[i] ? 58 + bassEnv * 12 : 26 + t * 34 + l.treble * 7

          const top = `hsl(${hue}, ${sat}%, ${Math.min(90, L)}%)`
          const left = `hsl(${hue}, ${sat}%, ${L * 0.5}%)`
          const right = `hsl(${hue}, ${sat}%, ${L * 0.34}%)`

          // left face
          g.fillStyle = left
          g.beginPath()
          g.moveTo(sx - cw, sy)
          g.lineTo(sx, sy + ch)
          g.lineTo(sx, sy + ch + dep)
          g.lineTo(sx - cw, sy + dep)
          g.closePath()
          g.fill()
          // right face
          g.fillStyle = right
          g.beginPath()
          g.moveTo(sx + cw, sy)
          g.lineTo(sx, sy + ch)
          g.lineTo(sx, sy + ch + dep)
          g.lineTo(sx + cw, sy + dep)
          g.closePath()
          g.fill()
          // top face
          g.fillStyle = top
          g.beginPath()
          g.moveTo(sx, sy - ch)
          g.lineTo(sx + cw, sy)
          g.lineTo(sx, sy + ch)
          g.lineTo(sx - cw, sy)
          g.closePath()
          g.fill()

          // Only the ring and the true peaks throw light. Everything else stays
          // matte — a bloom on every block turns the room into fog.
          const peak = rim[i] ? 0.34 + bassEnv * 0.24 : Math.max(0, t - 0.78) * 1.1
          if (peak > 0.03) {
            const rad = cw * (1.2 + t * 1.1)
            const grad = g.createRadialGradient(sx, sy - dep * 0.35, 0, sx, sy - dep * 0.35, rad)
            grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.min(86, L + 20)}%, ${Math.min(0.3, peak * 0.3)})`)
            grad.addColorStop(1, 'rgba(0,0,0,0)')
            g.fillStyle = grad
            g.fillRect(sx - rad, sy - dep * 0.35 - rad, rad * 2, rad * 2)
          }
        }
      }

      // the ring's own light, drawn once over the island instead of per block
      const ringR = h * 0.5
      const rg = g.createRadialGradient(originX, originY + h * 0.05, ringR * 0.2, originX, originY + h * 0.05, ringR)
      rg.addColorStop(0, `hsla(${ringHue}, 88%, 62%, ${0.09 + bassEnv * 0.09})`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.fillRect(0, h * 0.25, w, h * 0.75)
    })

    return () => {
      off()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
    }
  }, [palette, animations, reduced, density])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
