import { fuzzyScore } from '../lib/fuzzy'
import type { Song } from '../types/models'

export interface ImportEntry { title: string; artist?: string; album?: string }
export interface ImportOutcome { matched: string[]; unmatched: ImportEntry[] }

/** Parse JSON / M3U / M3U8 / CSV playlist exports into track entries. */
export async function parsePlaylistFile(file: File): Promise<ImportEntry[]> {
  const text = await file.text()
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) return parseJSONPlaylist(text)
  if (name.endsWith('.csv')) return parseCSV(text)
  return parseM3U(text)
}

function parseJSONPlaylist(text: string): ImportEntry[] {
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : (data.tracks ?? data.songs ?? data.items ?? [])
    const out: ImportEntry[] = []
    for (const it of arr) {
      if (typeof it === 'string') {
        out.push(entryFromPath(it))
      } else if (it && typeof it === 'object') {
        const title = it.title ?? it.name ?? it.track ?? it.song
        const artist = it.artist ?? it.artists?.[0]?.name ?? it.albumArtist
        if (title) out.push({ title: String(title), artist: artist ? String(artist) : undefined, album: it.album ? String(it.album) : undefined })
      }
    }
    return out
  } catch { throw new Error('This JSON playlist could not be parsed.') }
}

function parseM3U(text: string): ImportEntry[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: ImportEntry[] = []
  let pending: { title?: string; artist?: string } | null = null
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const meta = line.slice(line.indexOf(':') + 1)
      const title = meta.split(',')[1] ?? meta
      const artistMatch = meta.match(/^(.*?)\s*[-–]\s*(.*)$/)
      pending = artistMatch && artistMatch[1] && !/^\d+$/.test(artistMatch[1].trim())
        ? { artist: artistMatch[1].trim(), title: artistMatch[2].trim() }
        : { title: title.trim() }
    } else if (line.startsWith('#')) {
      continue
    } else {
      const fromPath = entryFromPath(line)
      out.push({
        title: pending?.title || fromPath.title,
        artist: pending?.artist || fromPath.artist,
      })
      pending = null
    }
  }
  return out
}

function entryFromPath(p: string): ImportEntry {
  const base = p.split(/[\\/]/).pop() ?? p
  const clean = base.replace(/\.[a-z0-9]+$/i, '').replace(/^\s*\d+[\s.\-_]+/, '')
  const m = clean.split(/\s+-\s+/)
  if (m.length >= 2) return { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() }
  return { title: clean }
}

function parseCSV(text: string): ImportEntry[] {
  const rows = text.split(/\r?\n/).filter((r) => r.trim())
  if (!rows.length) return []
  const split = (row: string) => {
    const cells: string[] = []
    let cur = '', q = false
    for (let i = 0; i < row.length; i++) {
      const c = row[i]
      if (c === '"') {
        if (q && row[i + 1] === '"') { cur += '"'; i++ } else q = !q
      } else if (c === ',' && !q) { cells.push(cur); cur = '' } else cur += c
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }
  const header = split(rows[0]).map((h) => h.toLowerCase())
  const ti = header.findIndex((h) => h === 'title' || h === 'name' || h === 'track' || h === 'song')
  const ai = header.findIndex((h) => h === 'artist' || h === 'artists')
  const bi = header.findIndex((h) => h === 'album')
  if (ti < 0) {
    // headerless: guess "artist,title" or "title"
    return rows.map((r) => {
      const c = split(r)
      return c.length >= 2 ? { artist: c[0], title: c[1] } : { title: c[0] }
    })
  }
  return rows.slice(1).map((r) => {
    const c = split(r)
    return { title: c[ti], artist: ai >= 0 ? c[ai] : undefined, album: bi >= 0 ? c[bi] : undefined }
  }).filter((e) => e.title)
}

/**
 * Match imported entries against the local library.
 * Scoring: title similarity (weighted) + artist bonus.
 */
export function matchEntries(entries: ImportEntry[], songs: Song[]): ImportOutcome {
  const matched: string[] = []
  const unmatched: ImportEntry[] = []
  const used = new Set<string>()
  for (const e of entries) {
    let bestId = '', best = 0
    for (const s of songs) {
      if (used.has(s.id)) continue
      const score = fuzzyScore(e.title, s.title) * 1.0 +
        (e.artist ? fuzzyScore(e.artist, s.artist) * 0.7 : 0) +
        (e.album && s.title ? fuzzyScore(e.album, s.albumId) * 0 : 0)
      if (score > best) { best = score; bestId = s.id }
    }
    if (bestId && best >= 28) {
      matched.push(bestId)
      used.add(bestId)
    } else {
      unmatched.push(e)
    }
  }
  return { matched, unmatched }
}
