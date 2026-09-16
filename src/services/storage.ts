// Namespaced localStorage. User data is isolated under `noct:v1:u:{uid}:*`,
// global data (user registry, session) under `noct:v1:g:*`.
const NS = 'noct:v1'

let activeUid: string | null = null
export function setUserScope(uid: string | null) { activeUid = uid }

function ls(): Storage { return window.localStorage }

export function loadGlobal<T>(key: string, fallback: T): T {
  try {
    const raw = ls().getItem(`${NS}:g:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

export function saveGlobal(key: string, data: unknown): void {
  try { ls().setItem(`${NS}:g:${key}`, JSON.stringify(data)) } catch { /* quota */ }
}

export function loadUser<T>(key: string, fallback: T): T {
  if (!activeUid) return fallback
  try {
    const raw = ls().getItem(`${NS}:u:${activeUid}:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

/**
 * Write under the given account (default: the one signed in now). Persisting is
 * debounced, so a write can outlive a sign-out; passing the uid it was scheduled
 * for keeps it out of whoever signed in next.
 */
export function saveUser(key: string, data: unknown, uid: string | null = activeUid): void {
  if (!uid) return
  try { ls().setItem(`${NS}:u:${uid}:${key}`, JSON.stringify(data)) } catch { /* quota */ }
}

export function wipeUser(uid: string): void {
  const prefix = `${NS}:u:${uid}:`
  const kill: string[] = []
  for (let i = 0; i < ls().length; i++) {
    const k = ls().key(i)
    if (k && k.startsWith(prefix)) kill.push(k)
  }
  kill.forEach((k) => ls().removeItem(k))
}
