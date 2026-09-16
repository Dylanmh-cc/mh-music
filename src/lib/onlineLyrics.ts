/**
 * Online lyrics lookup.
 *
 * After a song is imported we ask our own accounts server to look its words up
 * (it proxies the public LrcApi). No sidecar .lrc needed. Results are kept in a
 * per-session cache so re-importing the same library never re-queries.
 */
const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string) || ''
const cache = new Map<string, string | null>()

export async function fetchOnlineLyrics(
  artist: string,
  title: string,
  album?: string,
): Promise<string | null> {
  if (!AUTH_URL || !title) return null
  const key = [artist, title, album ?? ''].join('|').toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    const u = new URL(AUTH_URL.replace(/\/$/, '') + '/api/lyrics')
    u.searchParams.set('title', title)
    if (artist && artist !== 'Unknown Artist') u.searchParams.set('artist', artist)
    if (album && album !== 'Unknown Album') u.searchParams.set('album', album)
    const r = await fetch(u)
    if (!r.ok) { cache.set(key, null); return null }
    const data = await r.json().catch(() => ({}))
    const lyrics: string | null = typeof data.lyrics === 'string' ? data.lyrics : null
    cache.set(key, lyrics)
    return lyrics
  } catch {
    cache.set(key, null)
    return null
  }
}
