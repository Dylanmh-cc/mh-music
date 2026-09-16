import { useEffect, useState } from 'react'
import type { ViewID, ViewParams } from '../types/models'

/**
 * MH Music's router.
 *
 * Every surface in the product has a real address (`/home`, `/browse`,
 * `/albums`, `/songs`, `/recently-played`, `/player`, …) so navigation lives in
 * the URL hash rather than in component state. The ui store still exposes
 * `navigate(view, params)`; this module keeps the two in sync, which is what
 * gives working back/forward, shareable links and deep links to an album.
 */

export interface Route {
  path: string
  /** path without a leading slash, e.g. ['album', 'abc123'] */
  parts: string[]
}

/** the canonical address of every browsing surface */
const VIEW_PATH: Record<ViewID, string> = {
  home: '/home',
  browse: '/browse',
  albums: '/albums',
  artists: '/artists',
  songs: '/songs',
  playlists: '/playlists',
  favorites: '/favorites',
  recent: '/recently-played',
  folders: '/folders',
  import: '/import',
  visualizer: '/visualizer',
  settings: '/settings',
  album: '/album',
  artist: '/artist',
  playlist: '/playlist',
}

/** view + params → the canonical address */
export function viewToPath(view: ViewID, params: ViewParams = {}): string {
  const base = VIEW_PATH[view] ?? '/home'
  if (view === 'album' && params.albumId) return `${base}/${params.albumId}`
  if (view === 'artist' && params.artistId) return `${base}/${params.artistId}`
  if (view === 'playlist' && params.playlistId) return `${base}/${params.playlistId}`
  return base
}

/** the full-screen 3D music space. `/player` is canonical; the old path still works. */
export const PLAYER_PATH = '/player'
export const NOW_PLAYING_PATH = PLAYER_PATH
export const PROFILE_PATH = '/profile'
export const LOGIN_PATH = '/login'
export const REGISTER_PATH = '/register'

/** paths that are handled by the shell itself rather than by a browsing view */
const STANDALONE = new Set(['player', 'now-playing', 'profile', 'login', 'register', 'search'])

/** address → view + params (unknown paths fall back to home) */
export function pathToView(path: string): { view: ViewID; params: ViewParams } {
  const [head, id] = path.replace(/^\/+/, '').split('/')
  switch (head) {
    case 'album': return { view: 'album', params: { albumId: id } }
    case 'artist': return { view: 'artist', params: { artistId: id } }
    case 'playlist': return { view: 'playlist', params: { playlistId: id } }
    case 'browse': return { view: 'browse', params: {} }
    case 'albums': return { view: 'albums', params: {} }
    case 'artists': return { view: 'artists', params: {} }
    case 'songs': return { view: 'songs', params: {} }
    case 'playlists': return { view: 'playlists', params: {} }
    case 'favorites': return { view: 'favorites', params: {} }
    case 'recently-played':
    case 'recent': return { view: 'recent', params: {} }
    case 'folders': return { view: 'folders', params: {} }
    case 'import': return { view: 'import', params: {} }
    case 'visualizer': return { view: 'visualizer', params: {} }
    case 'settings': return { view: 'settings', params: {} }
    // `/library` was the pre-rebuild address for the song list
    case 'library': return { view: 'songs', params: {} }
    default: return { view: 'home', params: {} }
  }
}

export function readPath(): string {
  const raw = window.location.hash.replace(/^#/, '')
  return raw || '/home'
}

export function pushPath(path: string, replace = false) {
  const next = `#${path}`
  if (window.location.hash === next) return
  if (replace) window.history.replaceState(null, '', next)
  else window.history.pushState(null, '', next)
  // pushState does not fire hashchange
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** the current address, re-rendered on navigation and on back/forward */
export function useRoute(): string {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    const onChange = () => setPath(readPath())
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])
  return path
}

/** true for the full-screen 3D music space (`/player`, or its legacy alias) */
export const isNowPlaying = (path: string) => {
  const head = path.replace(/^\/+|\/+$/g, '').split('/')[0]
  return head === 'player' || head === 'now-playing'
}

/** true while the address belongs to the shell rather than to a browsing view */
export const isStandalone = (path: string) => STANDALONE.has(path.replace(/^\/+|\/+$/g, '').split('/')[0])
