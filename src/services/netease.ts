import { useSettingsStore } from '../stores/settings'
import { useLibraryStore } from '../stores/library'
import { toast } from '../stores/ui'
import type { NeteaseConfig } from '../types/models'

/**
 * NetEase Cloud Music adapter.
 *
 * ## What the official platform actually offers (developer.music.163.com)
 *
 * The landing page documents several onboarding tracks — mobile app, IoT
 * devices, hardware certification, game distribution — and, relevant here:
 *
 *   · 网页应用接入 — "使用云音乐 Web 端能力"
 *   · 活动接入 — "提供 JS-SDK 接入独立项目;提供 url 转发接入"
 *
 * So the supported browser integration is **their JS-SDK plus a redirect**, not
 * hand-signed REST calls written on our side. That matters for the design here:
 * with the SDK the login handshake happens on NetEase's own domain, which is
 * also why the AppSecret and the RSA private key never have to enter this
 * bundle. Their documentation is behind a developer sign-in, so the exact SDK
 * method names are configuration (`strategy` + `sdkUrl` in Settings) rather than
 * something assumed here — point them at whatever 文档中心 specifies and the
 * same code path runs.
 *
 * ## The two strategies
 *
 *   jssdk    load the platform's browser SDK, let it run the sign-in, then read
 *            playlists through it. The secrets stay with the platform.
 *   backend  talk to a server you control, which holds the AppSecret and the
 *            private key and signs every call:
 *
 *              browser ──(appId, session)──▶ your server ──(keys)──▶ NetEase
 *
 * ## What this can and cannot do
 *
 * It brings playlists across — names, artwork and track lists. It does not
 * stream NetEase audio: playing their catalogue is a licensing matter tied to
 * the partnership agreement, and a browser cannot decode it here. Tracks are
 * matched against files you own, and anything unmatched is reported as missing
 * rather than dropped, exactly like the file importer.
 */

export type NeteaseStatus = 'unconfigured' | 'offline' | 'ready' | 'signed-in'

interface QRStart { key: string; qrImage: string }

const SESSION_KEY = 'noct:v1:netease:session'

export function getConfig(): NeteaseConfig {
  return useSettingsStore.getState().settings.netease
}

export function isConfigured(c: NeteaseConfig = getConfig()): boolean {
  return c.strategy === 'jssdk' ? !!c.sdkUrl.trim() : c.strategy === 'backend' ? !!c.endpoint.trim() : false
}

/**
 * The platform's browser SDK, loaded on demand. It is their code, served from
 * their origin, and it owns the sign-in handshake — which is exactly why no
 * secret has to live in this bundle.
 */
declare global {
  interface Window {
    NetEaseCloudMusic?: {
      init?: (opts: { appId: string }) => void
      login?: () => Promise<unknown> | unknown
      getPlaylists?: () => Promise<unknown> | unknown
      getPlaylistTracks?: (id: string) => Promise<unknown> | unknown
    }
  }
}

let sdkPromise: Promise<NonNullable<Window['NetEaseCloudMusic']>> | null = null

function loadSdk(): Promise<NonNullable<Window['NetEaseCloudMusic']>> {
  if (window.NetEaseCloudMusic) return Promise.resolve(window.NetEaseCloudMusic)
  if (sdkPromise) return sdkPromise
  const url = getConfig().sdkUrl.trim()
  sdkPromise = new Promise((resolve, reject) => {
    if (!url) { reject(new Error('unconfigured')); return }
    const el = document.createElement('script')
    el.src = url
    el.async = true
    el.onload = () => {
      const sdk = window.NetEaseCloudMusic
      if (!sdk) { reject(new Error('SDK 已加载但没有注册自身')); return }
      sdk.init?.({ appId: getConfig().appId })
      resolve(sdk)
    }
    el.onerror = () => reject(new Error('SDK 脚本无法加载'))
    document.head.appendChild(el)
  })
  return sdkPromise
}

export function getSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY) } catch { return null }
}

function setSession(token: string | null) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable */ }
}

export function status(): NeteaseStatus {
  const c = getConfig()
  if (!isConfigured(c)) return 'unconfigured'
  if (!c.enabled) return 'offline'
  return getSession() ? 'signed-in' : 'ready'
}

/** One place for the plumbing: base URL, session header, JSON, and the
 *  difference between "you have not set this up" and "the server said no". */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = getConfig()
  if (!isConfigured(c)) throw new Error('unconfigured')
  const session = getSession()
  const res = await fetch(c.endpoint.replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`后端返回 ${res.status}`)
  return (await res.json()) as T
}

/** Step one of the sign-in. Over the SDK strategy the handshake happens on
 *  NetEase's own domain; over the backend strategy our server runs it. */
export async function startLogin(): Promise<QRStart | null> {
  if (getConfig().strategy === 'jssdk') {
    const sdk = await loadSdk()
    await sdk.login?.()
    return null
  }
  return call<QRStart>('/login/qr', { method: 'POST' })
}

/** Step two: poll until the phone confirms (803) or the code expires. */
export async function pollLogin(key: string): Promise<{ code: number; session?: string }> {
  const out = await call<{ code: number; session?: string }>(`/login/qr/check?key=${encodeURIComponent(key)}`)
  if (out.session) setSession(out.session)
  return out
}

export function signOut() {
  setSession(null)
}

export interface NeteasePlaylist { id: string; name: string; coverUrl?: string; trackCount?: number }
export interface NeteaseTrack { title: string; artist?: string; album?: string }

export async function fetchPlaylists(): Promise<NeteasePlaylist[]> {
  if (getConfig().strategy === 'jssdk') {
    const sdk = await loadSdk()
    const out = await sdk.getPlaylists?.()
    return normalisePlaylists(out)
  }
  const out = await call<{ playlists: NeteasePlaylist[] }>('/user/playlists')
  return out.playlists ?? []
}

/** The SDK returns its own shapes; accept the common ones rather than assuming
 *  a single field naming, so a doc-conformant SDK works without a rewrite. */
function normalisePlaylists(raw: unknown): NeteasePlaylist[] {
  const list = Array.isArray(raw) ? raw : (raw as { playlists?: unknown[] } | null)?.playlists
  if (!Array.isArray(list)) return []
  return list.map((p: any) => ({
    id: String(p?.id ?? p?.playlistId ?? ''),
    name: String(p?.name ?? p?.title ?? '歌单'),
    coverUrl: p?.coverUrl ?? p?.coverImgUrl ?? p?.picUrl,
    trackCount: typeof p?.trackCount === 'number' ? p.trackCount : p?.tracks?.length,
  })).filter((p) => p.id)
}

export async function fetchTracks(playlistId: string): Promise<NeteaseTrack[]> {
  if (getConfig().strategy === 'jssdk') {
    const sdk = await loadSdk()
    const out = await sdk.getPlaylistTracks?.(playlistId)
    const list = Array.isArray(out) ? out : (out as { tracks?: unknown[] } | null)?.tracks
    if (!Array.isArray(list)) return []
    return list.map((t: any) => ({
      title: String(t?.name ?? t?.title ?? ''),
      artist: t?.artists?.[0]?.name ?? t?.artist ?? t?.ar?.[0]?.name,
      album: t?.album?.name ?? t?.al?.name,
    })).filter((t) => t.title)
  }
  const out = await call<{ tracks: NeteaseTrack[] }>(`/playlist/tracks?id=${encodeURIComponent(playlistId)}`)
  return out.tracks ?? []
}

/**
 * Bring one NetEase playlist across: the name and artwork are kept as they are,
 * and each track is matched against the local library by title + artist. The
 * playlist is created either way, so the shape of your collection survives even
 * when the audio does not.
 */
export async function importPlaylist(pl: NeteasePlaylist): Promise<{ matched: number; missing: number }> {
  const lib = useLibraryStore.getState()
  const tracks = await fetchTracks(pl.id)

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
  const matched: string[] = []
  const missing: string[] = []

  for (const t of tracks) {
    const hit = lib.songs.find((s) =>
      norm(s.title) === norm(t.title) && (!t.artist || norm(s.artist).includes(norm(t.artist)) || norm(t.artist).includes(norm(s.artist))))
      ?? lib.songs.find((s) => norm(s.title) === norm(t.title))
    if (hit) matched.push(hit.id)
    else missing.push(`${t.artist ? t.artist + ' — ' : ''}${t.title}`)
  }

  const created = lib.createPlaylist(pl.name, matched, pl.coverUrl)
  if (created && missing.length) {
    // the same contract as the file importer: nothing is silently dropped
    toast('info', `「${pl.name}」:${matched.length} 首已匹配,${missing.length} 首不在你的音乐库中。`)
  }
  return { matched: matched.length, missing: missing.length }
}
