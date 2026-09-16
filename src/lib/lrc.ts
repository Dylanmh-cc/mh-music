import type { LyricLine } from '../types/models'

const TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

/**
 * Parse LRC-format lyrics. Returns sorted, non-empty lines.
 *
 * Also reads the common bilingual convention: when two lines carry the *same*
 * timestamp the second is the translation of the first, so a track that ships
 * translated lyrics gets them attached to the line they belong to.
 */
export function parseLrc(text: string): LyricLine[] {
  if (!text) return []
  const out: LyricLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    TAG.lastIndex = 0
    let m: RegExpExecArray | null
    const times: number[] = []
    while ((m = TAG.exec(raw))) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const fracRaw = m[3] ?? '0'
      const frac = parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length)
      times.push(min * 60 + sec + frac)
    }
    if (!times.length) continue
    const body = raw.replace(TAG, '').trim()
    if (!body) continue
    for (const t of times) {
      // same stamp as the line we just placed → this is its translation
      const prev = out[out.length - 1]
      if (prev && Math.abs(prev.time - t) < 0.02 && !prev.tr && prev.text !== body) {
        prev.tr = body
        continue
      }
      out.push({ time: t, text: body })
    }
  }
  return out.sort((a, b) => a.time - b.time)
}

/** Build LRC-ish lines from compact [t, text] tuples (demo data). */
export function lyricLines(pairs: Array<[number, string]>): LyricLine[] {
  return pairs.map(([time, text]) => ({ time, text })).sort((a, b) => a.time - b.time)
}

const stripBom = (s: string) => s.replace(/^\uFEFF/, '')

/**
 * Decode a lyric file from its raw bytes.
 *
 * `.lrc` files in the wild are UTF-8, UTF-16 or — very often, for Chinese
 * lyrics — GBK. `Blob.text()` only ever assumes UTF-8, which turns GBK words
 * into replacement characters (or, for a file that is mostly words, into
 * something that looks empty). So the bytes are read here and the encodings are
 * tried in order, keeping the first one that decodes cleanly.
 */
export function decodeLyricBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  if (!bytes.length) return ''
  // BOMs are definitive when present
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return stripBom(new TextDecoder('utf-16le').decode(bytes))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return stripBom(new TextDecoder('utf-16be').decode(bytes))

  const attempt = (enc: string) => { try { return new TextDecoder(enc).decode(bytes) } catch { return '' } }
  const utf8 = attempt('utf-8')
  if (utf8 && !utf8.includes('\uFFFD')) return stripBom(utf8)
  const gbk = attempt('gbk')
  if (gbk && !gbk.includes('\uFFFD')) return stripBom(gbk)
  // nothing decoded cleanly: keep the least damaged reading so the user can see
  // what happened rather than getting silence
  return stripBom(utf8 || gbk)
}

const hasTimestamps = (text: string) => { TAG.lastIndex = 0; return TAG.test(text) }

/**
 * Turn any lyric text into lines.
 *
 * Files carry words in two shapes and both have to work: a synced lyric has
 * `[mm:ss.xx]` markers and becomes a real timeline, while an unsynced one is
 * just prose. The prose case keeps every line at time 0 — `isSynced` is what
 * tells the player not to pretend it has timings.
 */
export function lyricsToLines(text: string | undefined): LyricLine[] | undefined {
  const t = (text ?? '').replace(/\r/g, '').trim()
  if (!t) return undefined
  if (hasTimestamps(t)) {
    const lines = parseLrc(t)
    return lines.length ? lines : undefined
  }
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.length ? lines.map((line) => ({ time: 0, text: line })) : undefined
}

/** True when the lines carry real timings. An unsynced lyric — pasted prose, or
 *  a USLT frame with no clock — must not be highlighted as if it were sung. */
export function isSynced(lines: LyricLine[] | undefined): boolean {
  return !!lines && lines.length > 1 && lines.some((l) => l.time > 0)
}
