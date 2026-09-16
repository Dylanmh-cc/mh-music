/** HSL → hex (or rgba) helper used by the procedural cover generator. */
export function hslHex(h: number, s: number, l: number, a?: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const f = (n: number) => {
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1))
    return Math.round(Math.max(0, Math.min(1, v)) * 255)
  }
  if (a !== undefined) return `rgba(${f(0)},${f(8)},${f(4)},${a})`
  const hex = ((1 << 24) + (f(0) << 16) + (f(8) << 8) + f(4)).toString(16).slice(1)
  return `#${hex}`
}
