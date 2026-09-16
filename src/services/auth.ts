import type { PublicUser, Session, StoredUser } from '../types/models'
import { loadGlobal, saveGlobal } from './storage'
import { uid } from '../lib/format'

/**
 * Authentication service.
 *
 * Two modes, chosen at build time:
 *
 *  · Remote — set `VITE_AUTH_URL` to a server implementing the small contract
 *    below and every call goes there, so an account works from any browser:
 *
 *        POST {AUTH_URL}/register   { name, email, password }  → { user, token }
 *        POST {AUTH_URL}/login      { email, password }        → { user, token }
 *        POST {AUTH_URL}/logout     (Bearer)                   → { ok }
 *        GET  {AUTH_URL}/session    (Bearer)                   → { user } | 401
 *
 *    The token is kept in storage and sent as `Authorization: Bearer`. A
 *    production server should hash passwords itself (scrypt/argon2), never
 *    store plaintext, and prefer HTTP-only cookies over a JS-readable token.
 *
 *  · Local — no `VITE_AUTH_URL`: the account lives in this browser only. That
 *    is the documented fallback, and it is what runs when you open the built
 *    site without standing a server up.
 */

const REMOTE = (import.meta.env.VITE_AUTH_URL ?? '').replace(/\/+$/, '')

/** True when the build was pointed at a real accounts server (VITE_AUTH_URL). */
export const REMOTE_AUTH = Boolean(REMOTE)

function authHeaders(): Record<string, string> {
  const token = readStoredToken()
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function remote<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(REMOTE + path, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `The server responded ${res.status}.`)
  return body as T
}

function readStoredToken(): string | null {
  try { return JSON.parse(window.localStorage.getItem('noct:v1:g:session') ?? 'null')?.token ?? null } catch { return null }
}

/**
 * Mock authentication service.
 *
 * The public API below mirrors what a real backend would expose
 * (register / login / logout / requestReset / resetPassword / verifySession)
 * so the UI can be re-pointed to HTTP endpoints without changes.
 *
 * Security posture for this local demo:
 *  · passwords are NEVER stored in plaintext — only a PBKDF2-SHA256 hash
 *    (150 000 iterations, per-user random salt) via WebCrypto
 *  · sessions use random tokens; "Remember me" persists the token, not the password
 *  · production: replace with server-side auth + HTTP-only cookies.
 */

const USERS_KEY = 'users'
const SESSION_KEY = 'session'
const ITERATIONS = 150_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key, 256,
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(len: number): string {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toPublic(u: StoredUser): PublicUser {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }
}

function readUsers(): StoredUser[] { return loadGlobal<StoredUser[]>(USERS_KEY, []) }
function writeUsers(users: StoredUser[]) { saveGlobal(USERS_KEY, users) }

export async function register(name: string, email: string, password: string): Promise<PublicUser> {
  const norm = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Please enter a display name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) throw new Error('Please enter a valid email address.')
  if (password.length < 6) throw new Error('Password must be at least 6 characters.')

  if (REMOTE) {
    const out = await remote<{ user: PublicUser; token: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: norm, password }),
    })
    persistSession({ uid: out.user.id, token: out.token }, true)
    return out.user
  }

  await sleep(420)
  const users = readUsers()
  if (users.some((u) => u.email === norm)) throw new Error('An account with this email already exists.')
  const salt = randomHex(16)
  const user: StoredUser = {
    id: uid('usr'), name: name.trim(), email: norm, salt,
    hash: await hashPassword(password, salt), createdAt: Date.now(),
  }
  users.push(user)
  writeUsers(users)
  // a fresh registration keeps the user signed in on this device
  persistSession({ uid: user.id, token: randomHex(24) }, true)
  return toPublic(user)
}

export async function login(email: string, password: string, remember: boolean): Promise<{ user: PublicUser; session: Session }> {
  const norm = email.trim().toLowerCase()

  if (REMOTE) {
    const out = await remote<{ user: PublicUser; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email: norm, password }),
    })
    const session: Session = { uid: out.user.id, token: out.token }
    persistSession(session, remember)
    return { user: out.user, session }
  }

  await sleep(380)
  const users = readUsers()
  const user = users.find((u) => u.email === norm)
  if (!user) throw new Error('No account found with this email.')
  const hash = await hashPassword(password, user.salt)
  if (hash !== user.hash) throw new Error('Incorrect password.')
  const session: Session = { uid: user.id, token: randomHex(24) }
  persistSession(session, remember)
  return { user: toPublic(user), session }
}

function persistSession(session: Session, remember: boolean) {
  try {
    if (remember) window.localStorage.setItem('noct:v1:g:session', JSON.stringify(session))
    else window.sessionStorage.setItem('noct:v1:g:session', JSON.stringify(session))
  } catch { /* storage blocked */ }
}

export function readSession(): Session | null {
  try {
    const s = window.sessionStorage.getItem('noct:v1:g:session') ?? window.localStorage.getItem('noct:v1:g:session')
    if (!s) return null
    const session = JSON.parse(s) as Session
    // With a backend the session is a token the server validates; the local
    // adapter additionally checks that the account still exists here.
    if (REMOTE) return session
    return readUsers().some((u) => u.id === session.uid) ? session : null
  } catch { return null }
}

/** Ask the server who this token belongs to. Used on boot in remote mode, so a
 *  revoked or expired session drops the user back to the sign-in screen. */
export async function verifyRemoteSession(): Promise<PublicUser | null> {
  if (!REMOTE) return null
  try {
    const out = await remote<{ user: PublicUser }>('/session')
    return out.user ?? null
  } catch {
    return null
  }
}

export function logout(): void {
  // tell the server first — a JS-readable token cannot be un-issued from here
  if (REMOTE) void remote('/logout', { method: 'POST' }).catch(() => { /* offline */ })
  try {
    window.localStorage.removeItem('noct:v1:g:session')
    window.sessionStorage.removeItem('noct:v1:g:session')
  } catch { /* ignore */ }
}

export async function requestResetCode(email: string): Promise<string> {
  await sleep(500)
  const users = readUsers()
  if (!users.some((u) => u.email === email.trim().toLowerCase())) {
    throw new Error('No account found with this email.')
  }
  // Mock e-mail delivery: the code is returned to the UI in this demo.
  const code = String(Math.floor(100000 + Math.random() * 900000))
  saveGlobal('reset', { email: email.trim().toLowerCase(), code, at: Date.now() })
  return code
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await sleep(420)
  const saved = loadGlobal<{ email: string; code: string; at: number } | null>('reset', null)
  if (!saved || saved.email !== email.trim().toLowerCase() || saved.code !== code.trim()) {
    throw new Error('Invalid reset code.')
  }
  if (Date.now() - saved.at > 10 * 60_000) throw new Error('Reset code expired. Request a new one.')
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.')
  const users = readUsers()
  const user = users.find((u) => u.email === email.trim().toLowerCase())
  if (!user) throw new Error('No account found with this email.')
  user.salt = randomHex(16)
  user.hash = await hashPassword(newPassword, user.salt)
  writeUsers(users)
}

export async function changePassword(currentUid: string, currentPw: string, newPw: string): Promise<void> {
  await sleep(360)
  const users = readUsers()
  const user = users.find((u) => u.id === currentUid)
  if (!user) throw new Error('Not signed in.')
  if ((await hashPassword(currentPw, user.salt)) !== user.hash) throw new Error('Current password is incorrect.')
  user.salt = randomHex(16)
  user.hash = await hashPassword(newPw, user.salt)
  writeUsers(users)
}

export function listUsers(): PublicUser[] { return readUsers().map(toPublic) }
