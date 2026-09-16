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

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const path = new URL(req.url, 'http://x').pathname

  // Online lyrics proxy — upload a song and we look its words up for you, so
  // users never have to ship a sidecar .lrc. Read-only; no auth, just a thin
  // pass-through to the public LrcApi. Results are cached in the browser.
  if (path === '/api/lyrics' && req.method === 'GET') {
    const u = new URL(req.url, 'http://x')
    const title = (u.searchParams.get('title') || '').trim()
    const artist = (u.searchParams.get('artist') || '').trim()
    const album = (u.searchParams.get('album') || '').trim()
    if (!title) return json(res, 400, { error: 'title required' })
    try {
      const target = new URL('https://api.lrc.cx/lyrics')
      target.searchParams.set('title', title)
      if (artist) target.searchParams.set('artist', artist)
      if (album) target.searchParams.set('album', album)
      const upstream = await fetch(target, { signal: AbortSignal.timeout(15000) })
      const text = await upstream.text()
      // a usable LRC carries [mm:ss.xx] markers and is not a JSON error blob
      if (upstream.ok && text && text.includes('[') && !text.trimStart().startsWith('{')) {
        return json(res, 200, { lyrics: text })
      }
      return json(res, 200, { lyrics: null })
    } catch (e) {
      return json(res, 200, { lyrics: null, error: String((e && e.message) || e) })
    }
  }

  // Cheap translate proxy — used to render non-Chinese lyrics in Chinese.
  // One short segment at a time; the caller batches/caches in the browser.
  if (path === '/api/translate' && req.method === 'GET') {
    const u = new URL(req.url, 'http://x')
    const text = (u.searchParams.get('text') || '').slice(0, 4000)
    if (!text.trim()) return json(res, 200, { translation: '' })
    try {
      const g = new URL('https://translate.googleapis.com/translate_a/single')
      g.searchParams.set('client', 'gtx')
      g.searchParams.set('sl', 'auto')
      g.searchParams.set('tl', 'zh-CN')
      g.searchParams.set('dt', 't')
      g.searchParams.set('q', text)
      const r = await fetch(g, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await r.json()
      const translated = (data[0] || []).map((seg) => seg && seg[0]).filter(Boolean).join('')
      return json(res, 200, { translation: translated || '' })
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
