import { hashStr, mulberry32 } from './rand'
import { hslHex } from './colorhelpers'

/**
 * Generate a deterministic default album cover (data URL) for songs that
 * ship without embedded artwork — seeded by album + artist name.
 */
export function generateCover(album: string, artist: string): string {
  const size = 512
  const cv = document.createElement('canvas')
  cv.width = size; cv.height = size
  const ctx = cv.getContext('2d')
  if (!ctx) return ''
  const rnd = mulberry32(hashStr(album + '::' + artist))
  const h1 = rnd() * 360
  const h2 = (h1 + 30 + rnd() * 60) % 360

  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, hslHex(h1, 46, 16))
  g.addColorStop(0.6, hslHex(h1, 52, 30))
  g.addColorStop(1, hslHex(h2, 60, 12))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // glowing disc
  const cx = size * (0.32 + rnd() * 0.36)
  const cy = size * (0.3 + rnd() * 0.3)
  const r = size * (0.18 + rnd() * 0.1)
  const rg = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.4)
  rg.addColorStop(0, hslHex(h2, 80, 78, 0.95))
  rg.addColorStop(0.35, hslHex(h2, 75, 60, 0.5))
  rg.addColorStop(1, hslHex(h1, 70, 40, 0))
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, size, size)

  // arcs
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.strokeStyle = hslHex((h1 + i * 14) % 360, 70, 70 + rnd() * 15, 0.25 + rnd() * 0.3)
    ctx.lineWidth = 2 + rnd() * 4
    const y = size * (0.55 + i * 0.08)
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(size * 0.3, y - 30 - rnd() * 40, size * 0.7, y + 30 + rnd() * 40, size, y)
    ctx.stroke()
  }

  // grain
  const gr = ctx.createImageData(size, size)
  for (let i = 0; i < gr.data.length; i += 4) {
    const v = Math.random() * 255
    gr.data[i] = gr.data[i + 1] = gr.data[i + 2] = v
    gr.data[i + 3] = 10
  }
  ctx.putImageData(gr, 0, 0, 0, 0, size, size)

  // initials
  const initials = (album || 'NA').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  ctx.font = '600 96px "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24
  ctx.fillText(initials, size / 2, size * 0.82)

  return cv.toDataURL('image/jpeg', 0.85)
}
