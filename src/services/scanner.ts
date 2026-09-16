import type { Album, Artist, MusicFolder, Song } from '../types/models'
import { readTags, parseFromFilename, probeDuration, type AudioTags } from '../lib/id3'
import { parseLrc, lyricsToLines, decodeLyricBytes } from '../lib/lrc'
import { hashStr } from '../lib/rand'
import { generateCover } from '../lib/gencover'
import { idbSet } from '../lib/idb'
import { DEFAULT_PALETTE } from '../lib/color'

export const AUDIO_EXT = /\.(mp3|flac|wav|aac|m4a|ogg|oga|opus)$/i

export interface ScanResult {
  songs: Song[]
  albums: Album[]
  artists: Artist[]
  folder: MusicFolder
  /** Uploaded files, keyed to their song id, so they can be persisted in IndexedDB. */
  blobs?: Array<{ songId: string; file: File }>
}

export function albumKey(albumArtist: string | undefined, artist: string | undefined, name: string): string {
  return `${(albumArtist || artist || 'Unknown Artist').toLowerCase()}|${(name || 'Unknown Album').toLowerCase()}`
}

export function albumIdFor(key: string): string { return `al_${hashStr(key).toString(36)}` }
export function artistIdFor(name: string): string { return `ar_${hashStr(name.toLowerCase()).toString(36)}` }

/** Downscale a picture blob to a small persisted data URL (256px JPEG). */
async function blobToDataUrl(blob: Blob): Promise<string> {
  try {
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const s = 256
    const cv = document.createElement('canvas')
    cv.width = s; cv.height = s
    const ctx = cv.getContext('2d')!
    const side = Math.min(img.width, img.height)
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s)
    URL.revokeObjectURL(url)
    return cv.toDataURL('image/jpeg', 0.82)
  } catch {
    return ''
  }
}

interface Entry { file: File; path: string }

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: Entry[],
  lrcs: Map<string, string>,
  depth = 0,
): Promise<void> {
  if (depth > 6) return
  // @ts-expect-error async iterator on FileSystemDirectoryHandle
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      await walkDirectory(entry, `${prefix}${entry.name}/`, out, lrcs, depth + 1)
    } else if (AUDIO_EXT.test(entry.name)) {
      out.push({ file: entry as unknown as File, path: `${prefix}${entry.name}` })
    } else if (/\.lrc$/i.test(entry.name)) {
      try {
        const f = entry as unknown as File
        lrcs.set(`${prefix}${f.name.replace(/\.lrc$/i, '').toLowerCase()}`, decodeLyricBytes(await f.arrayBuffer()))
      } catch { /* unreadable lrc */ }
    }
  }
}

export interface ScanHooks {
  onProgress?: (done: number, total: number, current: string) => void
}

/** Probe durations with a small concurrency pool (large folders stay responsive). */
async function probeAll(urls: string[], concurrency = 4): Promise<number[]> {
  const out = new Array<number>(urls.length).fill(0)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++
      out[i] = await probeDuration(urls[i])
    }
  })
  await Promise.all(workers)
  return out
}

async function finalizeScan(entries: Entry[], folder: MusicFolder, lrcs: Map<string, string>, hooks?: ScanHooks): Promise<ScanResult> {
  const songs: Song[] = []
  const albumMap = new Map<string, Album>()
  const artistMap = new Map<string, Artist>()
  const total = entries.length
  let done = 0

  // pass 1: tags + identity (no audio decoding yet)
  const pending: Array<{ entry: Entry; song: Song; tags: AudioTags; album: Album }> = []

  for (const { file, path } of entries) {
    hooks?.onProgress?.(done, total, file.name)
    done++
    let tags: AudioTags = {}
    try { tags = await readTags(file) } catch { /* untagged */ }
    const fname = parseFromFilename(file.name)
    const title = tags.title || fname.title || file.name
    const artist = tags.artist || fname.artist || 'Unknown Artist'
    const albumName = tags.album || 'Unknown Album'
    const albumArtist = tags.albumArtist || artist
    const aKey = albumKey(albumArtist, artist, albumName)
    const aId = albumIdFor(aKey)
    const songId = `song_${hashStr(folder.id + '|' + path).toString(36)}`
    const url = URL.createObjectURL(file)
    const baseKey = path.replace(AUDIO_EXT, '').toLowerCase()
    const lrcText = lrcs.get(baseKey)

    const song: Song = {
      id: songId,
      title,
      artist,
      albumId: aId,
      albumArtist,
      genre: tags.genre,
      year: tags.year,
      track: tags.track,
      disc: tags.disc,
      duration: 0,
      url,
      source: folder.kind === 'fsapi' ? 'fs' : 'upload',
      folderId: folder.id,
      path,
      coverUrl: '',
      playCount: 0,
      addedAt: Date.now(),
      // a sidecar .lrc wins; otherwise fall back to the words carried in the
      // file's own tags, which is all an uploaded single file will ever have
      lrc: lrcText ? parseLrc(lrcText) : lyricsToLines(tags.lyrics),
    }
    songs.push(song)

    let album = albumMap.get(aId)
    if (!album) {
      album = {
        id: aId, name: albumName, artist, albumArtist,
        year: tags.year, genre: tags.genre, coverUrl: '', palette: DEFAULT_PALETTE,
        songIds: [], letter: (albumName[0] ?? '#').toUpperCase(), source: folder.kind === 'fsapi' ? 'fs' : 'upload',
        addedAt: Date.now(),
      }
      albumMap.set(aId, album)
    }
    album.songIds.push(songId)
    pending.push({ entry: { file, path }, song, tags, album })

    const artId = artistIdFor(artist)
    let art = artistMap.get(artId)
    if (!art) {
      art = { id: artId, name: artist, albumIds: [], songIds: [], letter: (artist[0] ?? '#').toUpperCase() }
      artistMap.set(artId, art)
    }
    art.songIds.push(songId)
  }

  // pass 2: durations (concurrent) — done once per file, not per album
  const durations = await probeAll(songs.map((s) => s.url))
  songs.forEach((s, i) => { s.duration = durations[i] })

  // pass 3: album artwork
  for (const album of albumMap.values()) {
    const first = pending.find((p) => p.song.albumId === album.id)
    let cover = ''
    const pic = first?.tags.picture
    if (pic) cover = await blobToDataUrl(pic.blob)
    album.coverUrl = cover || generateCover(album.name, album.artist)
    album.songIds.sort((a, b) => {
      const sa = songs.find((s) => s.id === a)!, sb = songs.find((s) => s.id === b)!
      return (sa.track ?? 0) - (sb.track ?? 0)
    })
  }
  for (const song of songs) song.coverUrl = albumMap.get(song.albumId)!.coverUrl

  for (const art of artistMap.values()) {
    art.albumIds = [...new Set(songs.filter((s) => art.songIds.includes(s.id)).map((s) => s.albumId))]
  }

  hooks?.onProgress?.(total, total, '')
  return {
    songs,
    albums: [...albumMap.values()],
    artists: [...artistMap.values()],
    folder,
    blobs: folder.kind === 'upload' ? pending.map((p) => ({ songId: p.song.id, file: p.entry.file })) : undefined,
  }
}

/** Scan a picked directory (File System Access API). */
export async function scanFSDirectory(handle: FileSystemDirectoryHandle, hooks?: ScanHooks): Promise<ScanResult> {
  const folderId = `fld_${hashStr(handle.name + '::fsapi').toString(36)}`
  const entries: Entry[] = []
  const lrcs = new Map<string, string>()
  await walkDirectory(handle, '', entries, lrcs)
  const result = await finalizeScan(entries, {
    id: folderId, name: handle.name, kind: 'fsapi', fileCount: entries.length, addedAt: Date.now(),
  }, lrcs, hooks)
  try { await idbSet(folderId, handle) } catch { /* persistence optional */ }
  return result
}

/** Re-scan a previously added folder using its persisted handle. */
export async function rescanFSDirectory(handle: FileSystemDirectoryHandle, existing: MusicFolder, hooks?: ScanHooks): Promise<ScanResult> {
  const entries: Entry[] = []
  const lrcs = new Map<string, string>()
  await walkDirectory(handle, '', entries, lrcs)
  return finalizeScan(entries, { ...existing, fileCount: entries.length }, lrcs, hooks)
}

/** Fallback path: <input webkitdirectory> or a loose multi-file selection. */
export async function scanFileList(files: File[], folderName: string, kind: 'fsapi' | 'upload'): Promise<ScanResult> {
  const folderId = `fld_${hashStr(folderName + '::' + kind).toString(36)}`
  const entries: Entry[] = files
    .filter((f) => AUDIO_EXT.test(f.name))
    .map((f) => ({ file: f, path: ((f as any).webkitRelativePath as string | undefined) || f.name }))
  const lrcs = new Map<string, string>()
  for (const f of files) {
    if (/\.lrc$/i.test(f.name)) {
      const rel = ((f as any).webkitRelativePath as string | undefined) || f.name
      lrcs.set(rel.replace(/\.lrc$/i, '').toLowerCase(), decodeLyricBytes(await f.arrayBuffer()))
    }
  }
  return finalizeScan(entries, {
    id: folderId, name: folderName, kind, fileCount: entries.length, addedAt: Date.now(),
  }, lrcs)
}
