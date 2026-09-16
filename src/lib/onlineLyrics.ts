import type { Song } from '../types/models'

/**
 * Online lyrics lookup.
 *
 * The words are fetched through a **proxy**, never straight from the public
 * lyric APIs: `api.lrc.cx` answers without an `Access-Control-Allow-Origin`
 * header, so a page-level fetch is refused by CORS before the body is readable.
 * Two proxies ship with the project and both answer the same shape:
 *
 *   · `netlify/functions/lyrics.mjs` — runs on Netlify, so the deployed site
 *     works with nothing to host (`/api/lyrics`).
 *   · `server/auth-server.mjs` — the optional accounts server, same path, for
 *     self-hosted setups (`VITE_AUTH_URL/api/lyrics`).
 *
 * The provider chain behind that path (LrcApi, then TuneHub's NetEase/Kuwo/QQ
 * aggregation) is the one the lyricFlow utility uses; which one is tried first
 * is configurable per user and per deployment.
 */

const AUTH_URL = (import.meta.env.VITE_AUTH_URL as string) || ''

/** per-session cache: re-importing the same library never re-queries */
const cache = new Map<string, string | null>()
/** remember which endpoint actually answered, so we do not retry dead ones */
let preferred: string | null = null

export interface LyricSource {
  endpoint: string
  provider: 'lrcapi' | 'tunehub'
}

export interface LyricHit {
  text: string
  source: string
  provider: string
}

function candidates(configured: string): string[] {
  const list: string[] = []
  const push = (u: string) => { if (u && !list.includes(u)) list.push(u) }
  // the configured endpoint first, then the two built-in proxies
  if (configured) push(configured)
  push('/api/lyrics')
  if (AUTH_URL) push(`${AUTH_URL.replace(/\/$/, '')}/api/lyrics`)
  if (preferred) {
    const i = list.indexOf(preferred)
    if (i > 0) list.splice(i, 1), list.unshift(preferred)
  }
  return list
}

const keyOf = (artist: string, title: string, album?: string) =>
  [artist, title, album ?? ''].join('|').toLowerCase()

/**
 * One lookup. Returns null when nothing was found (or no proxy is reachable) —
 * callers treat both as "no lyrics", and the cache keeps the answer for the
 * session so a whole library costs one request per track.
 */
export async function lookupLyrics(
  artist: string,
  title: string,
  album?: string,
  opts: Partial<LyricSource> = {},
): Promise<LyricHit | null> {
  if (!title) return null
  const key = keyOf(artist, title, album)
  const cached = cache.get(key)
  if (cached === null) return null
  if (typeof cached === 'string') return { text: cached, source: 'cache', provider: 'cache' }

  const provider = opts.provider ?? 'lrcapi'
  for (const endpoint of candidates(opts.endpoint ?? '')) {
    try {
      const u = new URL(endpoint, window.location.origin)
      u.searchParams.set('title', title)
      // "未知歌手" is our own placeholder, not something to search for
      if (artist && !/^未知/.test(artist) && artist !== 'Unknown Artist') u.searchParams.set('artist', artist)
      if (album && !/^未知/.test(album) && album !== 'Unknown Album') u.searchParams.set('album', album)
      u.searchParams.set('provider', provider)
      const r = await fetch(u, { headers: { accept: 'application/json' } })
      if (!r.ok) continue
      const data = await r.json().catch(() => null)
      // A 200 that isn't JSON is a static-host SPA fallback, not a real answer —
      // skip it and try the next endpoint instead of giving up.
      if (!data || typeof data !== 'object') continue
      const lyrics = typeof data?.lyrics === 'string' && data.lyrics.trim() ? data.lyrics : null
      if (lyrics) {
        cache.set(key, lyrics)
        preferred = endpoint
        return { text: lyrics, source: endpoint, provider: String(data?.source ?? provider) }
      }
      // a 200 with no lyrics is a real answer from a working proxy
      cache.set(key, null)
      preferred = endpoint
      return null
    } catch {
      // network/CORS/JSON failure: try the next candidate
    }
  }
  cache.set(key, null)
  return null
}

/** Backwards-compatible wrapper: the lyric text, or null. */
export async function fetchOnlineLyrics(
  artist: string,
  title: string,
  album?: string,
  opts: Partial<LyricSource> = {},
): Promise<string | null> {
  const hit = await lookupLyrics(artist, title, album, opts)
  return hit ? hit.text : null
}

export interface FillProgress {
  done: number
  total: number
  found: number
}

/**
 * Walk a list of tracks that still have no words and fetch what is missing.
 *
 * Sequential on purpose: the provider is a public service, and a hundred
 * parallel lookups would be both rude and rate-limited. `shouldStop` lets the
 * caller cancel mid-run.
 */
export async function fillMissingLyrics(
  songs: Song[],
  opts: Partial<LyricSource> & { onProgress?: (p: FillProgress) => void; shouldStop?: () => boolean } = {},
): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  const total = songs.length
  let done = 0
  for (const song of songs) {
    if (opts.shouldStop?.()) break
    const hit = await lookupLyrics(song.artist, song.title, undefined, opts)
    if (hit) found.set(song.id, hit.text)
    done += 1
    opts.onProgress?.({ done, total, found: found.size })
  }
  return found
}

/** Forget the session cache (used when the user changes lyric sources). */
export function clearLyricCache(): void {
  cache.clear()
  preferred = null
}
