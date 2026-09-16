/**
 * Netlify Function: the lyrics proxy.
 *
 * Browsers cannot read the public lyric APIs directly — `api.lrc.cx` answers
 * without an `Access-Control-Allow-Origin` header, so a page-level fetch is
 * refused by CORS before the body is ever readable. That is why the deployed
 * site had no lyrics: it is a static bundle with nothing to proxy through.
 *
 * So the lookup happens here, server-side, using the same providers the
 * lyricFlow utility uses:
 *
 *   1. LrcApi     GET {LRCAPI_URL}/lyrics?title&artist&album  → LRC text
 *                 (default https://api.lrc.cx, optional LRCAPI_AUTH header)
 *   2. TuneHub    GET {API_BASE_URL}/api/?type=aggregateSearch&keyword=…
 *                 → results with per-platform lrc_url, then the best match
 *                 (default https://music-dl.sayqz.com)
 *
 * No dependencies: Node 18+ has global fetch. Nothing is cached server-side —
 * the client caches per session, and the CDN edge is asked to hold it briefly.
 */

const LRCAPI_URL = () => (process.env.LRCAPI_URL || 'https://api.lrc.cx').replace(/\/+$/, '')
const LRCAPI_AUTH = () => process.env.LRCAPI_AUTH || ''
const TUNEHUB_URL = () => (process.env.API_BASE_URL || 'https://music-dl.sayqz.com').replace(/\/+$/, '')
/** Which provider to try first: 'lrcapi' (default) or 'tunehub'. */
const PROVIDER = () => (process.env.API_PROVIDER || 'lrcapi').toLowerCase()

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    // the app asks the same origin; a stray other origin gets nothing
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'cache-control': 'public, max-age=300',
    ...extra,
  },
})

/** LRC, or a JSON/prose blob that is not lyrics. */
function looksLikeLrc(text) {
  return !!text && text.includes('[') && !text.trimStart().startsWith('{')
}

/** Does the payload carry real timings ([mm:ss.xx]) rather than plain text? */
function isTimed(text) {
  return /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(text)
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')

/**
 * Is this really the song that was asked for?
 *
 * LrcApi fuzzy-matches: ask it for a title it does not have and it answers with
 * its closest guess, in plain `[!text]` form (no timings). Attaching that to a
 * library during a bulk fill would put someone else's words on a track, so:
 *
 *   · a timed lyric for a title+artist query is accepted as-is;
 *   · an untimed one is only accepted when the title (or the artist) actually
 *     appears in its text or in the LRC's own [ti:]/[ar:] tags.
 */
function plausible(title, artist, text) {
  if (isTimed(text)) return true
  const tagged = [...text.matchAll(/^\[(ti|ar):(.+?)\]$/gim)].map((m) => norm(m[2])).join(' ')
  const body = norm(text.replace(/^\[!text\]/gim, ''))
  const hay = `${tagged} ${body}`
  const t = norm(title)
  if (t && t.length >= 2 && hay.includes(t)) return true
  const a = norm(artist)
  return !!(a && a.length >= 2 && hay.includes(a))
}

/** The plain-text form is usable, but its marker is not part of the words. */
const cleanPayload = (text) => text.replace(/^\[!text\]\s*/gim, '')

async function fromLrcApi(title, artist, album) {
  const u = new URL(`${LRCAPI_URL()}/lyrics`)
  u.searchParams.set('title', title)
  if (artist) u.searchParams.set('artist', artist)
  if (album) u.searchParams.set('album', album)
  const auth = LRCAPI_AUTH()
  const r = await fetch(u, {
    headers: auth ? { Authorization: auth } : undefined,
    signal: AbortSignal.timeout(9000),
  })
  if (!r.ok) return null
  const text = await r.text()
  if (!looksLikeLrc(text)) return null
  return plausible(title, artist, text) ? cleanPayload(text) : null
}

async function fromTuneHub(title, artist, album) {
  const keyword = `${artist || ''} ${title}`.trim()
  const u = new URL(`${TUNEHUB_URL()}/api/`)
  u.searchParams.set('type', 'aggregateSearch')
  u.searchParams.set('keyword', keyword)
  const r = await fetch(u, { signal: AbortSignal.timeout(9000) })
  if (!r.ok) return null
  const data = await r.json().catch(() => null)
  const results = data?.data?.results
  if (!Array.isArray(results) || !results.length) return null

  // Best match first: exact title, then artist overlap, then platform order.
  const want = title.trim().toLowerCase()
  const who = (artist || '').trim().toLowerCase()
  const order = ['netease', 'kuwo', 'qq']
  let best = null
  let bestScore = 0
  for (const res of results) {
    const name = String(res?.name ?? '').trim().toLowerCase()
    const by = String(res?.artist ?? '').trim().toLowerCase()
    let score = 0
    if (name === want) score += 100
    else if (want && name.includes(want)) score += 50
    if (who && (by.includes(who) || who.includes(by))) score += 30
    if (album && String(res?.album ?? '').toLowerCase().includes(String(album).toLowerCase())) score += 12
    const idx = order.indexOf(String(res?.platform ?? '').toLowerCase())
    if (idx >= 0) score += 10 - idx
    if (score > bestScore) { bestScore = score; best = res }
  }
  if (!best || bestScore < 30 || !best.lrc_url) return null
  const lr = await fetch(best.lrc_url, { signal: AbortSignal.timeout(9000) })
  if (!lr.ok) return null
  const text = await lr.text()
  return looksLikeLrc(text) ? text : null
}

export default async function handler(req) {
  const url = new URL(req.url)
  const title = url.searchParams.get('title')?.trim()
  const artist = url.searchParams.get('artist')?.trim() || ''
  const album = url.searchParams.get('album')?.trim() || ''
  if (!title) return json(400, { error: 'title is required', lyrics: null })

  const asked = (url.searchParams.get('provider') || PROVIDER()).toLowerCase()
  const chain = asked === 'tunehub'
    ? [['tunehub', fromTuneHub], ['lrcapi', fromLrcApi]]
    : [['lrcapi', fromLrcApi], ['tunehub', fromTuneHub]]

  for (const [name, fn] of chain) {
    try {
      const lyrics = await fn(title, artist, album)
      if (lyrics) return json(200, { lyrics, source: name })
    } catch {
      // a provider being slow or offline is not an error the UI needs
    }
  }
  return json(200, { lyrics: null, source: null })
}

export const config = { path: '/api/lyrics' }
