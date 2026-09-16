/**
 * On-demand Chinese translation for lyrics.
 *
 * Chinese lyrics need no translation; English/Korean/Japanese lines are sent
 * to our backend proxy (which forwards to Google Translate) and rendered under
 * the original line. Results are cached in-memory so re-opening the player or
 * the same line never re-translates.
 */
const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string) || ''
const cache = new Map<string, string>()

const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s)

/** A line counts as "already Chinese" when a chunk of it is Chinese. */
export function isMostlyChinese(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  const han = (t.match(/[\u4e00-\u9fff]/g) || []).length
  const letters = (t.match(/[a-z\uac00-\ud7af\u3040-\u30ff]/gi) || []).length
  return han >= 2 || (han / Math.max(1, han + letters)) > 0.3
}

export async function translateToChinese(text: string): Promise<string> {
  const t = text.trim()
  if (!t || isMostlyChinese(t)) return ''
  if (cache.has(t)) return cache.get(t) || ''
  try {
    const u = new URL(AUTH_URL.replace(/\/$/, '') + '/api/translate')
    u.searchParams.set('text', t)
    const r = await fetch(u)
    if (!r.ok) { cache.set(t, ''); return '' }
    const data = await r.json().catch(() => ({}))
    const out = typeof data.translation === 'string' ? data.translation : ''
    cache.set(t, out)
    return out
  } catch {
    cache.set(t, '')
    return ''
  }
}

/** Translate a list of unique lines serially, returning a map original→Chinese. */
export async function translateLines(lines: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(lines.map((l) => l.trim()).filter((l) => l && !isMostlyChinese(l)))]
  const out: Record<string, string> = {}
  for (const line of uniq) {
    const zh = await translateToChinese(line)
    if (zh) out[line] = zh
  }
  return out
}
