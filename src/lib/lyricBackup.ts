import type { Song } from '../types/models'
import { fuzzyScore } from './fuzzy'
import { lyricsToLines } from './lrc'

/**
 * Lyrics backup.
 *
 * Lyrics live inside the per-user library record in this browser, so clearing
 * site data, signing in as someone else, or re-uploading a library loses words
 * that took effort to collect. This exports them as one small JSON file and puts
 * them back by matching title + artist, which is the only pair that survives a
 * re-scan (song ids are derived from the file path).
 */

const KIND = 'mh-music-lyrics'

export interface LyricBackupEntry {
  title: string
  artist: string
  album?: string
  /** the raw lyric text, LRC or plain prose */
  text: string
}

export function buildLyricBackup(songs: Song[]): { blob: Blob; count: number } {
  const tracks: LyricBackupEntry[] = songs
    .filter((s) => s.lrc?.length)
    .map((s) => ({
      title: s.title,
      artist: s.artist,
      text: s.lrc!.map((l) => `[${fmtStamp(l.time)}]${l.text}`).join('\n'),
    }))
  const payload = {
    app: 'MH Music',
    kind: KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    tracks,
  }
  return {
    blob: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    count: tracks.length,
  }
}

function fmtStamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.round((sec - Math.floor(sec)) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export interface RestoreResult {
  matched: Map<string, string>
  restored: number
  skipped: number
  /** entries that matched no track in the library */
  unmatched: string[]
}

/**
 * Match a backup against the current library. A track is only taken when the
 * match is convincing, so a restored lyric never lands on the wrong song.
 */
export async function readLyricBackup(file: File, songs: Song[]): Promise<RestoreResult> {
  const raw = await file.text()
  const data = JSON.parse(raw) as { kind?: string; tracks?: Array<Partial<LyricBackupEntry>> }
  const entries = Array.isArray(data?.tracks) ? data.tracks : []
  if (data?.kind && data.kind !== KIND) throw new Error('这不是 MH Music 的歌词备份文件。')
  const matched = new Map<string, string>()
  const unmatched: string[] = []
  let skipped = 0
  const used = new Set<string>()

  for (const e of entries) {
    const title = String(e?.title ?? '').trim()
    const text = String(e?.text ?? '').trim()
    if (!title || !text) { skipped += 1; continue }
    const artist = String(e?.artist ?? '').trim()
    let bestId = ''
    let best = 0
    for (const s of songs) {
      if (used.has(s.id)) continue
      const score = fuzzyScore(title, s.title) + (artist ? fuzzyScore(artist, s.artist) * 0.7 : 0)
      if (score > best) { best = score; bestId = s.id }
    }
    if (bestId && best >= 28) {
      // a matched track keeps whatever it already has; the backup only fills gaps
      const target = songs.find((s) => s.id === bestId)
      if (target?.lrc?.length) { skipped += 1; continue }
      if (!lyricsToLines(text)?.length) { skipped += 1; continue }
      matched.set(bestId, text)
      used.add(bestId)
    } else {
      unmatched.push(artist ? `${artist} — ${title}` : title)
    }
  }
  return { matched, restored: matched.size, skipped, unmatched }
}
