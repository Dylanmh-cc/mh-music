import type { Palette } from '../types/models'

// ─── color primitives ───────────────────────────────────────────────────────
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export function lighten(hex: string, t: number): string { return mix(hex, '#ffffff', t) }
export function darken(hex: string, t: number): string { return mix(hex, '#000000', t) }

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#10131a' : '#f4f7fb'
}

// ─── palette extraction from artwork ────────────────────────────────────────
export const DEFAULT_PALETTE: Palette = {
  primary: '#6f8cff',
  accent: '#9ee8ff',
  glow: 'rgba(111,140,255,0.35)',
  deep: '#07080d',
  deep2: '#10131d',
  soft: '#1a2030',
}

function cssHue(h: number, s: number, l: number): string {
  return hslToHex(((h % 360) + 360) % 360, s, l)
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

/**
 * Extract a palette from an image URL (canvas sampling + hue buckets).
 * The result is deliberately clamped: environments stay dark but tinted
 * (never pure black) and accents stay luminous, so any artwork — including
 * near-black covers — still yields a readable, ambient-lit UI.
 */
export async function extractPalette(url: string): Promise<Palette> {
  try {
    const img = await loadImage(url)
    const size = 48
    const cv = document.createElement('canvas')
    cv.width = size; cv.height = size
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return DEFAULT_PALETTE
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    const buckets = new Map<number, { r: number; g: number; b: number; n: number; l: number; sat: number }>()
    let totalL = 0, totalSat = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (data[i + 3] < 8) continue
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const l = (mx + mn) / 510
      const d = mx - mn
      const sat = mx === 0 ? 0 : d / mx
      totalL += l; totalSat += sat; count++
      let h = 0
      if (d < 18) h = -1
      else if (mx === r) h = 60 * (((g - b) / d) % 6)
      else if (mx === g) h = 60 * ((b - r) / d + 2)
      else h = 60 * ((r - g) / d + 4)
      if (h < 0 && d >= 18) h += 360
      const key = d < 18 ? -1 : Math.round(h / 18)
      const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, l: 0, sat: 0 }
      cur.r += r; cur.g += g; cur.b += b; cur.n++; cur.l += l; cur.sat += sat
      buckets.set(key, cur)
    }
    if (!count || !buckets.size) return DEFAULT_PALETTE

    const sorted = [...buckets.entries()].sort((a, b) => b[1].n - a[1].n)
    const chromatic = sorted.filter(([k, v]) => k >= 0 && v.l / v.n < 0.82) // ignore blown highlights
    const achromatic = sorted.filter(([k]) => k < 0)
    const first = chromatic[0] ?? achromatic[0] ?? sorted[0]
    const avg = (e: { r: number; g: number; b: number; n: number }) =>
      rgbToHex(e.r / e.n, e.g / e.n, e.b / e.n)
    const base = avg(first[1])
    const [h0] = hexToHsl(base)

    // is the artwork essentially monochrome?
    const domSat = first[1].sat / first[1].n
    const mono = first[0] < 0 || domSat < 0.16

    const primary = mono ? hslToHex(h0, 10, 78) : hslToHex(h0, clamp(first[1].sat / first[1].n * 100, 58, 86), 62)
    const accent = mono ? '#eef3fa' : hslToHex(h0 + 26, clamp((first[1].sat / first[1].n) * 100 + 12, 62, 90), 74)
    const deep = mono ? hslToHex(h0, 8, 6) : hslToHex(h0, clamp(domSat * 46, 20, 46), 7)
    const deep2 = mono ? hslToHex(h0, 10, 10) : hslToHex(h0, clamp(domSat * 58, 26, 54), 13)
    const soft = mono ? hslToHex(h0, 8, 17) : hslToHex(h0, clamp(domSat * 50, 24, 48), 21)

    return sanitizePalette({
      primary,
      accent,
      glow: rgba(primary, 0.4),
      deep,
      deep2,
      soft,
    })
  } catch {
    return DEFAULT_PALETTE
  }
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGBA_RE = /^rgba?\([\d.,\s%]+\)$/i

export function isValidColor(c: unknown): c is string {
  return typeof c === 'string' && (HEX_RE.test(c) || RGBA_RE.test(c))
}

const clamp = (v: number, lo: number, hi: number) => (!isFinite(v) ? lo : Math.max(lo, Math.min(hi, v)))

/**
 * Guarantees every theme value is a valid CSS color and keeps the
 * environment legible: backgrounds stay dark-but-tinted, accents luminous.
 */
export function sanitizePalette(p: Palette): Palette {
  const out: Palette = { ...DEFAULT_PALETTE }
  for (const key of ['primary', 'accent', 'glow', 'deep', 'deep2', 'soft'] as const) {
    out[key] = isValidColor(p?.[key]) ? (p[key] as string) : DEFAULT_PALETTE[key]
  }
  if (isValidColor(out.deep)) {
    const [h, s, l] = hexToHsl(out.deep)
    out.deep = hslToHex(h, clamp(s, 6, 48), clamp(l, 4, 13))
  }
  if (isValidColor(out.deep2)) {
    const [h, s, l] = hexToHsl(out.deep2)
    out.deep2 = hslToHex(h, clamp(s, 8, 54), Math.max(clamp(l, 7, 18), hexToHsl(out.deep)[2] + 4))
  }
  if (isValidColor(out.primary)) {
    const [h, s, l] = hexToHsl(out.primary)
    out.primary = hslToHex(h, clamp(s, 26, 88), clamp(l, 48, 76))
  }
  if (isValidColor(out.accent)) {
    const [h, s, l] = hexToHsl(out.accent)
    out.accent = hslToHex(h, clamp(s, 22, 92), clamp(l, 60, 88))
  }
  out.glow = rgba(out.primary, 0.4)
  return out
}

export function hexToHsl(hex: string): [number, number, number] {
  let [r, g, b] = hexToRgb(hex)
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let h = 0
  const l = (mx + mn) / 2
  const d = mx - mn
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6)
    else if (mx === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return [((h % 360) + 360) % 360, s * 100, l * 100]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

// ─── theme application ──────────────────────────────────────────────────────
export function themeVars(p: Palette): Record<string, string> {
  return {
    '--c-accent': p.primary,
    '--c-accent-2': p.accent,
    '--c-glow': rgba(p.primary, 0.4),
    '--c-glow-soft': rgba(p.primary, 0.16),
    '--c-deep-0': p.deep,
    '--c-deep-1': p.deep2,
    '--c-tint': rgba(p.primary, 0.1),
    '--c-tint-2': rgba(p.accent, 0.07),
  }
}

export function applyTheme(p: Palette): void {
  const root = document.documentElement
  const safe = sanitizePalette(p)
  for (const [k, v] of Object.entries(themeVars(safe))) root.style.setProperty(k, v)
}
