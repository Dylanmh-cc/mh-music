import { create } from 'zustand'
import type { Album, Artist, HistoryEntry, LyricLine, MusicFolder, Playlist, ScanState, Song } from '../types/models'
import { loadUser, saveUser } from '../services/storage'
import { buildDemoLibrary, demoLyricsFor } from '../data/demo'
import { lyricsToLines } from '../lib/lrc'
import {
  scanFSDirectory, rescanFSDirectory, scanFileList,
  albumKey, albumIdFor, artistIdFor,
} from '../services/scanner'
import { parsePlaylistFile, matchEntries, type ImportEntry } from '../services/importer'
import { idbGet, idbDel, putFileBlob, getFileBlob, deleteFileBlobs, supportsFS } from '../lib/idb'
import { extractPalette, DEFAULT_PALETTE } from '../lib/color'
import { uid } from '../lib/format'
import { toast } from './ui'
import { usePlayerStore } from './player'

interface Favorites { songs: string[]; albums: string[]; artists: string[] }

interface LibraryState {
  userId: string | null
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  folders: MusicFolder[]
  favorites: Favorites
  playlists: Playlist[]
  history: HistoryEntry[]
  scan: ScanState | null
  /** set once the user removes the demo collection, so it never comes back */
  demoCleared: boolean

  hydrate: (uid: string) => Promise<void>
  clearInMemory: () => void
  addFolderFS: () => Promise<void>
  addFolderUpload: (files: FileList) => Promise<void>
  rescanFolder: (folderId: string) => Promise<void>
  removeFolder: (folderId: string) => void
  toggleFavSong: (id: string) => void
  toggleFavAlbum: (id: string) => void
  toggleFavArtist: (id: string) => void
  createPlaylist: (name: string, songIds?: string[], coverUrl?: string) => Playlist | null
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  /** set or clear a playlist's own artwork */
  setPlaylistCover: (id: string, coverUrl?: string) => void
  addToPlaylist: (playlistId: string, songIds: string[]) => void
  removeFromPlaylist: (playlistId: string, songId: string) => void
  reorderPlaylist: (playlistId: string, songIds: string[]) => void
  importPlaylistFile: (file: File, name: string) => Promise<{ matched: number; unmatched: ImportEntry[] }>
  removeSong: (songId: string, silent?: boolean) => void
  deleteAlbum: (albumId: string) => void
  deleteLocalFile: (songId: string) => Promise<void>
  hasLocalFile: (songId: string) => boolean
  /** drop every demo album/track, keeping the user's own music untouched */
  clearDemo: () => void
  demoCount: () => number
  recordPlay: (songId: string) => void
  clearHistory: () => void
  ensurePalette: (albumId: string) => Promise<void>
  getSong: (id: string) => Song | undefined
  getAlbum: (id: string) => Album | undefined
  getArtist: (id: string) => Artist | undefined
  getLyrics: (song: Song) => LyricLine[]
  /** attach lyrics the user pasted or picked; pass nothing to clear them */
  setSongLyrics: (songId: string, text?: string) => void
  __merge: (songs: Song[], albums: Album[], artists: Artist[], folder: MusicFolder) => void
}

interface Serialized {
  demoCleared?: boolean
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  folders: MusicFolder[]
  favorites: Favorites
  playlists: Playlist[]
  history: HistoryEntry[]
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(state: LibraryState) {
  if (!state.userId) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    // blob: URLs die on reload — urls for fs/upload songs are re-created on hydrate
    const songs = state.songs.map((s) => (s.source === 'demo' ? s : { ...s, url: '' }))
    const data: Serialized = {
      songs, albums: state.albums, artists: state.artists,
      folders: state.folders, favorites: state.favorites,
      playlists: state.playlists, history: state.history.slice(-400), demoCleared: state.demoCleared,
    }
    saveUser('library', data)
  }, 500)
}

/** Resolve a relative path inside a directory handle → File */
async function fileByPath(root: FileSystemDirectoryHandle, path: string): Promise<File | null> {
  try {
    const parts = path.split('/').filter(Boolean)
    let dir = root
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }
    const fh = await dir.getFileHandle(parts[parts.length - 1])
    return await fh.getFile()
  } catch { return null }
}

function sortAlbumSongs(album: Album, songs: Song[]) {
  album.songIds.sort((a, b) => {
    const sa = songs.find((s) => s.id === a), sb = songs.find((s) => s.id === b)
    return (sa?.disc ?? 0) - (sb?.disc ?? 0) || (sa?.track ?? 0) - (sb?.track ?? 0)
  })
}

/**
 * Remove a set of tracks and cascade everywhere they are referenced: albums,
 * artists, playlists, favorites and history. Every delete path funnels through
 * here so no view can keep showing a dead track.
 */
function purgeSongs(state: LibraryState, ids: Set<string>) {
  const songs = state.songs.filter((s) => !ids.has(s.id))
  const albums = state.albums
    .map((a) => (a.songIds.some((id) => ids.has(id)) ? { ...a, songIds: a.songIds.filter((id) => !ids.has(id)) } : a))
    .filter((a) => a.songIds.length || a.source === 'demo')
  const liveAlbumIds = new Set(albums.map((a) => a.id))
  const artists = state.artists
    .map((a) => ({
      ...a,
      songIds: a.songIds.filter((id) => !ids.has(id)),
      albumIds: a.albumIds.filter((id) => liveAlbumIds.has(id)),
    }))
    .filter((a) => a.songIds.length)
  const liveArtistIds = new Set(artists.map((a) => a.id))
  return {
    songs,
    albums,
    artists,
    playlists: state.playlists.map((p) => (
      p.songIds.some((id) => ids.has(id)) ? { ...p, songIds: p.songIds.filter((id) => !ids.has(id)) } : p
    )),
    favorites: {
      songs: state.favorites.songs.filter((id) => !ids.has(id)),
      albums: state.favorites.albums.filter((id) => liveAlbumIds.has(id)),
      artists: state.favorites.artists.filter((id) => liveArtistIds.has(id)),
    },
    history: state.history.filter((h) => !ids.has(h.songId)),
  }
}

/**
 * Shared tail for every delete path: persist, drop cached audio blobs, and
 * tell the player to forget tracks that no longer exist (so nothing keeps
 * playing behind an empty transport).
 */
function afterPurge(ids: Set<string>) {
  persist(useLibraryStore.getState())
  deleteFileBlobs([...ids]).catch(() => { /* ignore */ })
  usePlayerStore.getState().dropRemoved([...ids])
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  userId: null,
  songs: [],
  albums: [],
  artists: [],
  folders: [],
  favorites: { songs: [], albums: [], artists: [] },
  playlists: [],
  history: [],
  scan: null,
  demoCleared: false,

  hydrate: async (uid) => {
    const saved = loadUser<Serialized | null>('library', null)
    if (saved && saved.songs?.length) {
      set({ ...saved, userId: uid, scan: null })
      const songs = get().songs.map((s) => ({ ...s }))

      // 1) uploaded tracks: restore playable URLs from persisted blobs
      for (const s of songs) {
        if (s.url || s.source !== 'upload') continue
        try {
          const blob = await getFileBlob(s.id)
          if (blob) s.url = URL.createObjectURL(blob)
        } catch { /* unavailable */ }
      }
      set({ songs })

      // 2) linked folders: recreate URLs where permission already survives
      for (const f of get().folders) {
        if (f.kind !== 'fsapi') continue
        try {
          const handle = await idbGet<FileSystemDirectoryHandle>(f.id)
          if (!handle) continue
          const perm = await (handle as any).queryPermission?.({ mode: 'read' })
          if (perm !== 'granted') continue
          for (const s of songs) {
            if (s.folderId !== f.id || s.url) continue
            const file = await fileByPath(handle, s.path ?? '')
            if (file) s.url = URL.createObjectURL(file)
          }
        } catch { /* ignore */ }
      }
      set({ songs })
    } else if (saved?.demoCleared) {
      // the user cleared the demo collection and has nothing of their own yet:
      // start them on an empty library rather than re-seeding the preview
      set({
        userId: uid, songs: [], albums: [], artists: [], folders: [],
        favorites: { songs: [], albums: [], artists: [] },
        playlists: [], history: [], scan: null, demoCleared: true,
      })
    } else {
      const demo = buildDemoLibrary()
      set({
        userId: uid, songs: demo.songs, albums: demo.albums, artists: demo.artists,
        folders: [], favorites: { songs: [], albums: [], artists: [] },
        playlists: [], history: [], scan: null, demoCleared: false,
      })
      persist(get())
    }
  },

  clearInMemory: () => set({
    userId: null, songs: [], albums: [], artists: [], folders: [],
    favorites: { songs: [], albums: [], artists: [] }, playlists: [], history: [], scan: null,
    demoCleared: false,
  }),

  addFolderFS: async () => {
    if (!supportsFS) {
      toast('info', 'Your browser can’t open folders directly — pick files instead.')
      return
    }
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
      set({ scan: { active: true, done: 0, total: 0, current: '', folderName: handle.name } })
      const result = await scanFSDirectory(handle, {
        onProgress: (done, total, current) => set({ scan: { active: true, done, total, current, folderName: handle.name } }),
      })
      get().__merge(result.songs, result.albums, result.artists, result.folder)
      toast('success', `Added “${result.folder.name}” — ${result.songs.length} tracks.`)
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast('error', 'Folder access was denied.')
    } finally {
      set({ scan: null })
    }
  },

  addFolderUpload: async (files) => {
    const arr = Array.from(files)
    if (!arr.length) return
    const dirName = ((arr[0] as any).webkitRelativePath?.split('/')[0] as string | undefined)?.trim() || 'Uploaded files'
    set({ scan: { active: true, done: 0, total: arr.length, current: '', folderName: dirName } })
    try {
      const result = await scanFileList(arr, dirName, 'upload')
      get().__merge(result.songs, result.albums, result.artists, result.folder)
      // persist the actual audio so uploaded tracks keep working after a reload
      const blobs = result.blobs ?? []
      let stored = 0
      for (const b of blobs) {
        try { await putFileBlob(b.songId, b.file); stored++ } catch { /* quota / private mode */ }
      }
      toast('success', stored === blobs.length && blobs.length
        ? `Added ${result.songs.length} tracks from “${dirName}” — kept for offline after reload.`
        : `Added ${result.songs.length} tracks from “${dirName}”.`)
    } catch {
      toast('error', 'Could not read those files.')
    } finally {
      set({ scan: null })
    }
  },

  rescanFolder: async (folderId) => {
    const folder = get().folders.find((f) => f.id === folderId)
    if (!folder) return
    try {
      const handle = await idbGet<FileSystemDirectoryHandle>(folder.id)
      if (!handle) { toast('error', 'Folder handle lost — please add the folder again.'); return }
      let perm = await (handle as any).queryPermission?.({ mode: 'read' })
      if (perm !== 'granted') perm = await (handle as any).requestPermission?.({ mode: 'read' })
      if (perm !== 'granted') { toast('error', 'Permission denied for this folder.'); return }
      set({ scan: { active: true, done: 0, total: 0, current: '', folderName: folder.name } })
      const result = await rescanFSDirectory(handle, folder, {
        onProgress: (done, total, current) => set({ scan: { active: true, done, total, current, folderName: folder.name } }),
      })
      get().__merge(result.songs, result.albums, result.artists, result.folder)
      toast('success', `Rescanned “${folder.name}” — ${result.songs.length} tracks.`)
    } catch {
      toast('error', 'Could not read this folder.')
    } finally {
      set({ scan: null })
    }
  },

  removeFolder: (folderId) => {
    const state = get()
    const removedIds = new Set(state.songs.filter((s) => s.folderId === folderId).map((s) => s.id))
    set({
      ...purgeSongs(state, removedIds),
      folders: state.folders.filter((f) => f.id !== folderId),
    })
    // drop the persisted directory handle too, so the folder is really gone
    idbDel(folderId).catch(() => { /* ignore */ })
    afterPurge(removedIds)
    toast('info', 'Folder removed from your library.')
  },

  toggleFavSong: (id) => {
    set((s) => ({ favorites: { ...s.favorites, songs: s.favorites.songs.includes(id) ? s.favorites.songs.filter((x) => x !== id) : [id, ...s.favorites.songs] } }))
    persist(get())
  },
  toggleFavAlbum: (id) => {
    set((s) => ({ favorites: { ...s.favorites, albums: s.favorites.albums.includes(id) ? s.favorites.albums.filter((x) => x !== id) : [id, ...s.favorites.albums] } }))
    persist(get())
  },
  toggleFavArtist: (id) => {
    set((s) => ({ favorites: { ...s.favorites, artists: s.favorites.artists.includes(id) ? s.favorites.artists.filter((x) => x !== id) : [id, ...s.favorites.artists] } }))
    persist(get())
  },

  createPlaylist: (name, songIds = [], coverUrl) => {
    if (!name.trim()) { toast('error', 'Give your playlist a name.'); return null }
    const pl: Playlist = { id: uid('pl'), name: name.trim(), songIds: [...new Set(songIds)], createdAt: Date.now(), coverUrl }
    set((s) => ({ playlists: [pl, ...s.playlists] }))
    persist(get())
    toast('success', `Playlist “${pl.name}” created.`)
    return pl
  },
  setPlaylistCover: (id, coverUrl) => {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, coverUrl } : p)) }))
    persist(get())
  },
  renamePlaylist: (id, name) => {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) }))
    persist(get())
  },
  deletePlaylist: (id) => {
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
    persist(get())
    toast('info', 'Playlist deleted.')
  },
  addToPlaylist: (playlistId, songIds) => {
    set((s) => ({
      playlists: s.playlists.map((p) => (p.id === playlistId
        ? { ...p, songIds: [...p.songIds, ...songIds.filter((id) => !p.songIds.includes(id))] }
        : p)),
    }))
    persist(get())
    const pl = get().playlists.find((p) => p.id === playlistId)
    toast('success', `Added to “${pl?.name ?? 'playlist'}”.`)
  },
  removeFromPlaylist: (playlistId, songId) => {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, songIds: p.songIds.filter((id) => id !== songId) } : p)) }))
    persist(get())
  },
  reorderPlaylist: (playlistId, songIds) => {
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, songIds } : p)) }))
    persist(get())
  },

  importPlaylistFile: async (file, name) => {
    const entries = await parsePlaylistFile(file)
    if (!entries.length) throw new Error('No tracks found in this file.')
    const { matched, unmatched } = matchEntries(entries, get().songs)
    if (matched.length) get().createPlaylist(name, matched)
    else toast('info', 'No matching songs found in your library.')
    return { matched: matched.length, unmatched }
  },

  removeSong: (songId, silent) => {
    const state = get()
    const song = state.songs.find((s) => s.id === songId)
    if (!song) return
    set(purgeSongs(state, new Set([songId])))
    afterPurge(new Set([songId]))
    if (!silent) toast('info', `Removed “${song.title}” from your library.`)
  },

  /** Delete an album and every track filed under it. */
  deleteAlbum: (albumId) => {
    const state = get()
    const album = state.albums.find((a) => a.id === albumId)
    if (!album) return
    const ids = new Set(album.songIds)
    if (!ids.size) {
      // an album with no tracks left — just drop the shelf label
      set({ albums: state.albums.filter((a) => a.id !== albumId) })
      persist(get())
      toast('info', `Deleted “${album.name}”.`)
      return
    }
    set(purgeSongs(state, ids))
    afterPurge(ids)
    toast('success', `Deleted “${album.name}” and ${ids.size} track${ids.size !== 1 ? 's' : ''}.`)
  },

  /** True when this track is backed by a real file inside a linked folder. */
  hasLocalFile: (songId) => {
    const s = get().songs.find((x) => x.id === songId)
    return !!s && s.source === 'fs' && !!s.folderId && !!s.path
  },

  demoCount: () => get().songs.filter((s) => s.source === 'demo').length,

  /**
   * Remove the built-in demo collection. Demo music is only ever a preview —
   * this keeps it out of the way once the user has their own library, and it
   * is remembered so a reload doesn't bring it back.
   */
  clearDemo: () => {
    const state = get()
    const ids = new Set(state.songs.filter((s) => s.source === 'demo').map((s) => s.id))
    if (!ids.size) { toast('info', 'There is no demo music to clear.'); return }
    const next = purgeSongs(state, ids)
    // purge keeps empty albums when they came from the demo set — drop them
    const albums = next.albums.filter((a) => a.source !== 'demo')
    const liveAlbums = new Set(albums.map((a) => a.id))
    const artists = next.artists
      .map((a) => ({ ...a, albumIds: a.albumIds.filter((id) => liveAlbums.has(id)) }))
      .filter((a) => a.albumIds.length)
    set({ ...next, albums, artists, demoCleared: true })
    afterPurge(ids)
    toast('success', `Cleared ${ids.size} demo track${ids.size !== 1 ? 's' : ''}. Your own music was kept.`)
  },

  /**
   * Erase the track's real file from the user's disk. Only ever called after
   * an explicit confirmation — the library default is remove-from-library.
   */
  deleteLocalFile: async (songId) => {
    const song = get().songs.find((s) => s.id === songId)
    if (!song || song.source !== 'fs' || !song.folderId || !song.path) {
      toast('error', 'This track has no local file to delete.')
      return
    }
    try {
      const root = await idbGet<FileSystemDirectoryHandle>(song.folderId)
      if (!root) { toast('error', 'Folder handle lost — rescan the folder first.'); return }
      let perm = await (root as any).queryPermission?.({ mode: 'readwrite' })
      if (perm !== 'granted') perm = await (root as any).requestPermission?.({ mode: 'readwrite' })
      if (perm !== 'granted') { toast('error', 'Folder permission denied.'); return }
      const parts = song.path.split('/').filter(Boolean)
      let dir = root
      for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i])
      await (dir as any).removeEntry(parts[parts.length - 1])
      get().removeSong(songId, true)
      toast('success', `Deleted the file for “${song.title}”.`)
    } catch {
      toast('error', 'Could not delete the local file.')
    }
  },

  recordPlay: (songId) => {
    set((s) => ({
      history: [...s.history.slice(-399), { songId, at: Date.now() }],
      songs: s.songs.map((song) => (song.id === songId ? { ...song, playCount: song.playCount + 1 } : song)),
    }))
    persist(get())
  },

  clearHistory: () => { set({ history: [] }); persist(get()) },

  ensurePalette: async (albumId) => {
    const album = get().albums.find((a) => a.id === albumId)
    if (!album) return
    const untouched = album.palette.deep === DEFAULT_PALETTE.deep && album.palette.primary === DEFAULT_PALETTE.primary
    if (!untouched || album.source === 'demo' || !album.coverUrl) return
    try {
      const palette = await extractPalette(album.coverUrl)
      set((s) => ({ albums: s.albums.map((a) => (a.id === albumId ? { ...a, palette } : a)) }))
      persist(get())
    } catch { /* keep default palette */ }
  },

  getSong: (id) => get().songs.find((s) => s.id === id),
  getAlbum: (id) => get().albums.find((a) => a.id === id),
  getArtist: (id) => get().artists.find((a) => a.id === id),
  /**
   * Attach lyrics to any track — the files that carry none, and the ones whose
   * embedded words are wrong. `lyricsToLines` decides whether what was handed in
   * is a synced LRC or plain prose, so both work.
   */
  setSongLyrics: (songId, text) => {
    const raw = (text ?? '').trim()
    const lrc = lyricsToLines(raw)
    if (!lrc) {
      // say which failure it was: an empty file reads very differently from an
      // unsupported one, and silence here is what made this look broken
      if (raw) toast('error', 'Could not read any lyric lines from that text.')
      else if (text !== undefined) toast('error', 'That file had no text in it.')
    }
    set((s) => ({ songs: s.songs.map((x) => (x.id === songId ? { ...x, lrc } : x)) }))
    persist(get())
    if (lrc) toast('success', `Lyrics saved — ${lrc.length} line${lrc.length === 1 ? '' : 's'}.`)
    else if (!raw && text === undefined) toast('info', 'Lyrics cleared.')
  },
  getLyrics: (song) => {
    if (song.lrc?.length) return song.lrc
    return demoLyricsFor(song.url) ?? []
  },

  __merge: (newSongs, newAlbums, newArtists, folder) => {
    const s = get()
    const songMap = new Map(s.songs.map((x) => [x.id, x]))
    for (const song of newSongs) songMap.set(song.id, song)
    const songs = [...songMap.values()]

    const albumMap = new Map(s.albums.map((x) => [x.id, { ...x }]))
    for (const a of newAlbums) {
      const existing = albumMap.get(a.id)
      if (existing) {
        existing.songIds = [...new Set([...existing.songIds, ...a.songIds])]
        existing.coverUrl = existing.source !== 'demo' && a.coverUrl ? a.coverUrl : existing.coverUrl
        existing.year = existing.year ?? a.year
        existing.genre = existing.genre ?? a.genre
      } else albumMap.set(a.id, { ...a })
    }
    const albums = [...albumMap.values()]
    for (const a of albums) if (a.source !== 'demo') sortAlbumSongs(a, songs)
    const liveAlbums = albums.filter((a) => a.songIds.length || a.source === 'demo')

    const artistMap = new Map(s.artists.map((x) => [x.id, { ...x }]))
    for (const ar of newArtists) {
      const existing = artistMap.get(ar.id)
      if (existing) existing.songIds = [...new Set([...existing.songIds, ...ar.songIds])]
      else artistMap.set(ar.id, { ...ar })
    }
    const artists = [...artistMap.values()].map((ar) => ({
      ...ar,
      albumIds: [...new Set(songs.filter((x) => ar.songIds.includes(x.id)).map((x) => x.albumId))],
    })).filter((a) => a.songIds.length)

    const folders = [...s.folders.filter((f) => f.id !== folder.id), folder]
    set({ songs, albums: liveAlbums, artists, folders })
    persist(get())
  },
}))

export { albumKey, albumIdFor, artistIdFor }
