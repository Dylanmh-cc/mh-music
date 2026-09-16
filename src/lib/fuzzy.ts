/** Lightweight fuzzy subsequence scoring (0 = no match, higher = better). */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim()
  const t = target.toLowerCase()
  if (!q) return 0.01
  if (t === q) return 100
  if (t.startsWith(q)) return 60 + Math.min(20, t.length === q.length ? 20 : 10)
  const idx = t.indexOf(q)
  if (idx >= 0) return 45 - Math.min(15, idx) + (idx === 0 ? 8 : 0)

  // subsequence with bonuses for consecutive runs / word starts
  let ti = 0, score = 0, run = 0
  const words = new Set(t.split(/[\s\-_/.,()&]+/))
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    const found = t.indexOf(ch, ti)
    if (found < 0) return 0
    run = found === ti ? run + 1 : 0
    score += 2 + run * 1.5
    if (found === 0 || /\s/.test(t[found - 1] ?? '')) score += 4
    if (words.has(ch)) score += 1
    ti = found + 1
  }
  score -= Math.max(0, t.length - q.length) * 0.08
  return Math.max(1, score)
}

export function bestMatch(query: string, candidates: string[]): number {
  let best = 0, bi = -1
  candidates.forEach((c, i) => {
    const s = fuzzyScore(query, c)
    if (s > best) { best = s; bi = i }
  })
  return bi
}
