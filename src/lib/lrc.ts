import type { LyricLine } from '../types/models'

const TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

// Credits / liner notes that some lyric providers dump into the synced file —
// they are not sung words, so they must never render as a lyric line. The
// Chinese labels matter as much as the English ones: the providers used here
// return 作词/作曲/编曲 as timed lines at the top of the file, always in the
// "作词 : 某人" shape, so a colon is required. That keeps a real lyric that
// happens to contain the word — "我为你作曲" — intact.
const CREDIT_EN = /(produced by|producer|written by|lyrics by|music by|composed by|arranged by|mix(?:ed|ing)? by|master(?:ed)? by|engineered by|recorded by|vocals by|label\s*[:：]|℗|©|all rights reserved|copyright|executive producer)/i
const CREDIT_ZH = /^\s*(作\s*词|作\s*曲|编\s*曲|詞\s*曲|词\s*曲|制\s*作\s*人|监\s*制|出\s*品|混\s*音|录\s*音|母\s*带|和\s*声|配\s*唱|吉\s*他|贝\s*斯|鼓\s*手|弦\s*乐|键\s*盘|发\s*行|录\s*音\s*室|o\.?p|s\.?p)\s*[:：]/i
const CREDIT_LINE = { test: (s: string) => CREDIT_EN.test(s) || CREDIT_ZH.test(s) }
// Bare section markers left behind by a timestamp tag, e.g. "[00:12.00][Verse]"
const SECTION_LINE = /^(verse|chorus|intro|outro|bridge|break|hook|refrain|pre-?chorus|post-?chorus|interlude|solo|coda|tag|drop|build-?up)(\s*\d+)?\s*:?$/i

/** Drop credits / section-marker lines from an already-parsed lyric list. */
export function filterCreditLines(lines: LyricLine[]): LyricLine[] {
  return lines.filter((l) => l.text.trim() && !CREDIT_LINE.test(l.text) && !SECTION_LINE.test(l.text.trim()))
}

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
  // a lone CR ends a line too: `\r?\n` would treat a CR-only file as one line
  for (const raw of text.split(/\r\n|\r|\n/)) {
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
    // drop production credits and bare section markers, never show them as lyrics
    if (CREDIT_LINE.test(body) || SECTION_LINE.test(body)) continue
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
  // CR and CRLF both end a line. Deleting carriage returns instead of treating
  // them as breaks collapsed a CR-only .lrc — still common in lyrics files
  // downloaded in the wild — into one enormous line: the words overflowed the
  // frame, there was no line left to advance, and the view sat mid-file.
  const t = (text ?? '').replace(/\r\n?/g, '\n').trim()
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
