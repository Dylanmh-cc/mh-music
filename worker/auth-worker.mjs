/**
 * MH Music accounts server — Cloudflare Worker edition.
 *
 * Same HTTP surface as server/auth-server.mjs:
 *   POST /register  { name, email, password }  -> { user, token }
 *   POST /login     { email, password }       -> { user, token }
 *   POST /logout    (Bearer)                  -> { ok }
 *   GET  /session   (Bearer)                  -> { user } | 401
 *
 * Differences for Workers:
 *   - Storage is a Cloudflare KV binding (env.MH_AUTH), one JSON document.
 *   - Password hashing uses Web Crypto PBKDF2 (SHA-256, 100k iterations)
 *     instead of node:crypto scrypt. Existing scrypt hashes are not imported;
 *     this is a fresh, permanent store.
 */

const PBKDF2_ITERATIONS = 100000

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt })

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}
function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function randomHex(bytes) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function hashPassword(password, saltHex) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return bytesToHex(new Uint8Array(bits))
}

async function readDb(env) {
  const raw = await env.MH_AUTH.get('db')
  return raw ? JSON.parse(raw) : { users: [], tokens: {} }
}
async function writeDb(env, db) {
  await env.MH_AUTH.put('db', JSON.stringify(db))
}

function json(code, body, origin) {
  return new Response(JSON.stringify(body), {
    status: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}

async function readBody(req) {
  try { return await req.json() } catch { return {} }
}
function tokenOf(req) {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
}

export default {
  async fetch(req, env) {
    const origin = env.CORS_ORIGIN ?? '*'
    const url = new URL(req.url)
    const path = url.pathname

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }})

    if (path === '/register' && req.method === 'POST') {
      const { name = '', email = '', password = '' } = await readBody(req)
      const norm = String(email).trim().toLowerCase()
      if (!String(name).trim()) return json(400, { error: 'Please enter a display name.' }, origin)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return json(400, { error: 'Please enter a valid email address.' }, origin)
      if (String(password).length < 6) return json(400, { error: 'Password must be at least 6 characters.' }, origin)

      const db = await readDb(env)
      if (db.users.some((u) => u.email === norm)) return json(409, { error: 'An account with this email already exists.' }, origin)

      const salt = randomHex(16)
      const user = {
        id: 'usr_' + randomHex(8),
        name: String(name).trim(), email: norm,
        salt, hash: await hashPassword(String(password), salt), createdAt: Date.now(),
      }
      const token = randomHex(32)
      db.users.push(user)
      db.tokens[token] = user.id
      await writeDb(env, db)
      return json(200, { user: publicUser(user), token }, origin)
    }

    if (path === '/login' && req.method === 'POST') {
      const { email = '', password = '' } = await readBody(req)
      const norm = String(email).trim().toLowerCase()
      const db = await readDb(env)
      const user = db.users.find((u) => u.email === norm)
      const fail = () => json(401, { error: 'Email or password is incorrect.' }, origin)
      if (!user) return fail()
      const expectedHex = user.hash
      const actualHex = await hashPassword(String(password), user.salt)
      if (expectedHex !== actualHex) return fail()
      const token = randomHex(32)
      db.tokens[token] = user.id
      await writeDb(env, db)
      return json(200, { user: publicUser(user), token }, origin)
    }

    if (path === '/logout' && req.method === 'POST') {
      const db = await readDb(env)
      delete db.tokens[tokenOf(req)]
      await writeDb(env, db)
      return json(200, { ok: true }, origin)
    }

    if (path === '/session' && req.method === 'GET') {
      const db = await readDb(env)
      const uid = db.tokens[tokenOf(req)]
      const user = uid && db.users.find((u) => u.id === uid)
      if (!user) return json(401, { error: 'Not signed in.' }, origin)
      return json(200, { user: publicUser(user) }, origin)
    }

    return json(404, { error: 'Not found' }, origin)
  },
}
