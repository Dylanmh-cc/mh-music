/**
 * MH Music — accounts server.
 *
 * The one piece a static site cannot do for itself. Deploy this anywhere Node
 * runs (Render, Railway, Fly, a VPS, a Cloudflare Worker with minor edits) and
 * point the frontend at it with `VITE_AUTH_URL`.
 *
 *   POST /register  { name, email, password } → { user, token }
 *   POST /login     { email, password }       → { user, token }
 *   POST /logout    (Bearer)                  → { ok }
 *   GET  /session   (Bearer)                  → { user } | 401
 *
 * Storage is a JSON file — swap `read()`/`write()` for Postgres/Redis when the
 * account count justifies it, nothing else changes.
 *
 *   node server/auth-server.mjs            # listens on :8787
 *   PORT=9000 DATA=./users.json node …
 *
 * Run it behind HTTPS. Passwords are hashed with scrypt and a per-user salt;
 * plaintext never touches the disk. Tokens are random 32-byte values, so keep
 * the data file private — anyone holding it can impersonate a session.
 */
import { createServer } from 'node:http'
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const PORT = Number(process.env.PORT ?? 8787)
// fileURLToPath, not `.pathname`: on Windows the latter yields "/D:/My%20Folder/…",
// which Node then reads as a relative path and fails to open
const DATA = process.env.DATA ?? fileURLToPath(new URL('./users.json', import.meta.url))
/** Set this to your site's origin in production; '*' is convenient locally. */
const ORIGIN = process.env.CORS_ORIGIN ?? '*'

const hash = (password, salt) => scrypt(password, salt, 64).then((b) => b.toString('hex'))
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt })

async function read() {
  try { return JSON.parse(await readFile(DATA, 'utf8')) } catch { return { users: [], tokens: {} } }
}
async function write(db) { await writeFile(DATA, JSON.stringify(db, null, 2)) }

const json = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

const body = (req) => new Promise((resolve) => {
  let raw = ''
  req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy() })
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')) } catch { resolve({}) } })
})

const tokenOf = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')

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
 * Is this really the song that was asked for? LrcApi fuzzy-matches: ask for a
 * title it does not have and it answers with its closest guess, in plain
 * [!text] form. A timed lyric for a title+artist query is taken as-is; an
 * untimed one only counts when the title or artist actually appears in it.
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

async function lyricsFromLrcApi(title, artist, album) {
  const base = (process.env.LRCAPI_URL || 'https://api.lrc.cx').replace(/\/+$/, '')
  const target = new URL(`${base}/lyrics`)
  target.searchParams.set('title', title)
  if (artist) target.searchParams.set('artist', artist)
  if (album) target.searchParams.set('album', album)
  const auth = process.env.LRCAPI_AUTH
  const upstream = await fetch(target, {
    headers: auth ? { Authorization: auth } : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!upstream.ok) return null
  const text = await upstream.text()
  if (!looksLikeLrc(text)) return null
  return plausible(title, artist, text) ? cleanPayload(text) : null
}

async function lyricsFromTuneHub(title, artist, album) {
  const base = (process.env.API_BASE_URL || 'https://music-dl.sayqz.com').replace(/\/+$/, '')
  const target = new URL(`${base}/api/`)
  target.searchParams.set('type', 'aggregateSearch')
  target.searchParams.set('keyword', `${artist} ${title}`.trim())
  const r = await fetch(target, { signal: AbortSignal.timeout(15000) })
  if (!r.ok) return null
  const data = await r.json().catch(() => null)
  const results = data && data.data && data.data.results
  if (!Array.isArray(results) || !results.length) return null
  const want = title.toLowerCase()
  const who = (artist || '').toLowerCase()
  let best = null
  let bestScore = 0
  for (const res of results) {
    const name = String(res?.name ?? '').toLowerCase()
    const by = String(res?.artist ?? '').toLowerCase()
    let score = 0
    if (name === want) score += 100
    else if (want && name.includes(want)) score += 50
    if (who && (by.includes(who) || who.includes(by))) score += 30
    if (album && String(res?.album ?? '').toLowerCase().includes(album.toLowerCase())) score += 12
    if (score > bestScore) { bestScore = score; best = res }
  }
  if (!best || bestScore < 30 || !best.lrc_url) return null
  const lr = await fetch(best.lrc_url, { signal: AbortSignal.timeout(15000) })
  if (!lr.ok) return null
  const text = await lr.text()
  return looksLikeLrc(text) ? text : null
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const path = new URL(req.url, 'http://x').pathname

  // Online lyrics proxy — upload a song and we look its words up for you, so
  // users never have to ship a sidecar .lrc. Read-only; no auth, just a thin
  // pass-through. The provider chain is the one lyricFlow uses: LrcApi first,
  // TuneHub (which aggregates NetEase/Kuwo/QQ) as the fallback. The browser
  // cannot call either directly — LrcApi answers without CORS headers — so this
  // proxy is what makes lyrics work at all. Configure via LRCAPI_URL /
  // LRCAPI_AUTH / API_BASE_URL / API_PROVIDER; results are cached client-side.
  if (path === '/api/lyrics' && req.method === 'GET') {
    const u = new URL(req.url, 'http://x')
    const title = (u.searchParams.get('title') || '').trim()
    const artist = (u.searchParams.get('artist') || '').trim()
    const album = (u.searchParams.get('album') || '').trim()
    if (!title) return json(res, 400, { error: 'title required' })
    const asked = (u.searchParams.get('provider') || process.env.API_PROVIDER || 'lrcapi').toLowerCase()
    const chain = asked === 'tunehub' ? ['tunehub', 'lrcapi'] : ['lrcapi', 'tunehub']
    for (const name of chain) {
      try {
        const lyrics = name === 'lrcapi'
          ? await lyricsFromLrcApi(title, artist, album)
          : await lyricsFromTuneHub(title, artist, album)
        if (lyrics) return json(res, 200, { lyrics, source: name })
      } catch (e) {
        // one provider being offline must not stop the other
      }
    }
    return json(res, 200, { lyrics: null })
  }

  // Cheap translate proxy — used to render non-Chinese lyrics in Chinese.
  // One short segment at a time; the caller batches/caches in the browser.
  if (path === '/api/translate' && req.method === 'GET') {
    const u = new URL(req.url, 'http://x')
    const text = (u.searchParams.get('text') || '').slice(0, 4000)
    if (!text.trim()) return json(res, 200, { translation: '' })
    // Try Google first; if its free endpoint rate-limits the server IP (it
    // returns an HTML challenge), fall back to MyMemory.
    try {
      const g = new URL('https://translate.googleapis.com/translate_a/single')
      g.searchParams.set('client', 'gtx')
      g.searchParams.set('sl', 'auto')
      g.searchParams.set('tl', 'zh-CN')
      g.searchParams.set('dt', 't')
      g.searchParams.set('q', text)
      const r = await fetch(g, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await r.json()
      const translated = (data[0] || []).map((seg) => seg && seg[0]).filter(Boolean).join('')
      if (translated) return json(res, 200, { translation: translated })
    } catch { /* fall through to MyMemory */ }
    try {
      const m = new URL('https://api.mymemory.translated.net/get')
      m.searchParams.set('q', text)
      m.searchParams.set('langpair', 'autodetect|zh-CN')
      const r2 = await fetch(m, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      const d2 = await r2.json()
      return json(res, 200, { translation: d2?.responseData?.translatedText || '' })
    } catch (e) {
      return json(res, 200, { translation: '', error: String((e && e.message) || e) })
    }
  }

  const db = await read()

  if (path === '/register' && req.method === 'POST') {
    const { name = '', email = '', password = '' } = await body(req)
    const norm = String(email).trim().toLowerCase()
    if (!String(name).trim()) return json(res, 400, { error: 'Please enter a display name.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return json(res, 400, { error: 'Please enter a valid email address.' })
    if (String(password).length < 6) return json(res, 400, { error: 'Password must be at least 6 characters.' })
    if (db.users.some((u) => u.email === norm)) return json(res, 409, { error: 'An account with this email already exists.' })

    const salt = randomBytes(16).toString('hex')
    const user = {
      id: 'usr_' + randomBytes(8).toString('hex'),
      name: String(name).trim(), email: norm,
      salt, hash: await hash(String(password), salt), createdAt: Date.now(),
    }
    const token = randomBytes(32).toString('hex')
    db.users.push(user)
    db.tokens[token] = user.id
    await write(db)
    return json(res, 200, { user: publicUser(user), token })
  }

  if (path === '/login' && req.method === 'POST') {
    const { email = '', password = '' } = await body(req)
    const norm = String(email).trim().toLowerCase()
    const user = db.users.find((u) => u.email === norm)
    // one message for both cases: telling an attacker which emails exist is a
    // free account-enumeration oracle
    const fail = () => json(res, 401, { error: 'Email or password is incorrect.' })
    if (!user) return fail()
    const [salt, expected] = [user.salt, Buffer.from(user.hash, 'hex')]
    const actual = Buffer.from(await hash(String(password), salt), 'hex')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return fail()
    const token = randomBytes(32).toString('hex')
    db.tokens[token] = user.id
    await write(db)
    return json(res, 200, { user: publicUser(user), token })
  }

  if (path === '/logout' && req.method === 'POST') {
    delete db.tokens[tokenOf(req)]
    await write(db)
    return json(res, 200, { ok: true })
  }

  if (path === '/session' && req.method === 'GET') {
    const uid = db.tokens[tokenOf(req)]
    const user = uid && db.users.find((u) => u.id === uid)
    if (!user) return json(res, 401, { error: 'Not signed in.' })
    return json(res, 200, { user: publicUser(user) })
  }

  json(res, 404, { error: 'Not found' })
}).listen(PORT, () => {
  console.log(`MH Music accounts server on http://localhost:${PORT}`)
  console.log(`data file: ${DATA}`)
})
