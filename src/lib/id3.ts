/**
 * Minimal in-browser audio tag reader.
 * Supports: MP3 ID3v2.2/2.3/2.4 (+ID3v1 fallback), FLAC VORBIS_COMMENT/PICTURE,
 * M4A/MP4 'ilst' atoms (first 1.5 MB). Falls back to filename parsing upstream.
 */

export interface AudioTags {
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number
  track?: number
  disc?: number
  genre?: string
  picture?: { blob: Blob; mime: string }
  /** lyrics carried inside the file: ID3 USLT/SYLT, M4A `©lyr`, Vorbis LYRICS.
   *  Timestamped when the frame had timings, plain text otherwise. */
  lyrics?: string
}

const dec = (enc: string) => (view: Uint8Array) => new TextDecoder(enc).decode(view)
const latin1 = dec('latin1')
const utf8 = dec('utf-8')
const utf16le = dec('utf-16le')
const utf16be = dec('utf-16be')

/** Decode a text body that *starts with* its encoding flag byte. */
function decodeText(bytes: Uint8Array): string {
  if (!bytes.length) return ''
  return decodeWith(bytes[0], bytes.subarray(1))
}

/** Decode text whose encoding is already known — used by the lyric frames,
 *  where the flag sits at the head of the frame and the words come later. */
function decodeWith(e: number, body: Uint8Array): string {
  if (!body.length) return ''
  try {
    if (e === 1) {
      if (body[0] === 0xff && body[1] === 0xfe) return utf16le(body.subarray(2))
      if (body[0] === 0xfe && body[1] === 0xff) return utf16be(body.subarray(2))
      return utf16le(body)
    }
    if (e === 2) return utf16be(body)
    if (e === 3) return utf8(body)
    return latin1(body)
  } catch { return '' }
}

function syncsafe(v: DataView, off: number): number {
  return ((v.getUint8(off) & 0x7f) << 21) | ((v.getUint8(off + 1) & 0x7f) << 14) |
    ((v.getUint8(off + 2) & 0x7f) << 7) | (v.getUint8(off + 3) & 0x7f)
}

function u32(v: DataView, off: number): number {
  return ((v.getUint8(off) << 24) | (v.getUint8(off + 1) << 16) | (v.getUint8(off + 2) << 8) | v.getUint8(off + 3)) >>> 0
}

function parseID3(buf: ArrayBuffer): AudioTags {
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const tags: AudioTags = {}
  if (u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return tags // "ID3"
  const major = u8[3]
  const size = syncsafe(dv, 6)
  let p = 10
  const end = Math.min(10 + size, u8.length)
  const str = (b: Uint8Array) => decodeText(b).replace(/\0+$/, '').trim()

  while (p + 10 <= end) {
    let id: string
    let fsize: number
    let hdr = 10
    if (major === 2) {
      id = latin1(u8.subarray(p, p + 3))
      fsize = (u8[p + 3] << 16) | (u8[p + 4] << 8) | u8[p + 5]
      hdr = 6
      if (!id) break
    } else {
      id = latin1(u8.subarray(p, p + 4))
      fsize = major === 4 ? syncsafe(dv, p + 4) : u32(dv, p + 4)
      if (!/^[A-Z0-9]{4}$/.test(id)) break
    }
    if (fsize <= 0 || p + hdr + fsize > end) break
    const body = u8.subarray(p + hdr, p + hdr + fsize)
    try {
      switch (id) {
        case 'TIT2': case 'TT2': tags.title = str(body); break
        case 'TPE1': case 'TP1': tags.artist = str(body); break
        case 'TPE2': case 'TP2': tags.albumArtist = str(body); break
        case 'TALB': case 'TAL': tags.album = str(body); break
        case 'TCON': case 'TCO': tags.genre = str(body); break
        case 'TDRC': case 'TYER': case 'TYE': {
          const y = parseInt(str(body).slice(0, 4), 10)
          if (y > 1000) tags.year = y
          break
        }
        case 'TRCK': case 'TRK': {
          const n = parseInt(str(body).split('/')[0], 10)
          if (n > 0) tags.track = n
          break
        }
        case 'TPOS': case 'TPA': {
          const n = parseInt(str(body).split('/')[0], 10)
          if (n > 0) tags.disc = n
          break
        }
        case 'USLT': case 'ULT': {
          // encoding(1) + language(3) + descriptor (NUL-terminated) + the words.
          // The words are decoded with the frame's own flag — they do not carry
          // one of their own, which is what `decodeWith` is for.
          const e = body[0]
          const wide = e === 1 || e === 2
          let q = 4
          if (wide) { while (q + 1 < body.length && !(body[q] === 0 && body[q + 1] === 0)) q += 2; q += 2 }
          else { while (q < body.length && body[q] !== 0) q++; q += 1 }
          const text = decodeWith(e, body.subarray(q)).replace(/\0+$/, '').trim()
          if (text) tags.lyrics = tags.lyrics ? `${tags.lyrics}\n${text}` : text
          break
        }
        case 'SYLT': case 'SLT': {
          // encoding(1) + language(3) + format(1) + type(1) + descriptor(NUL)
          // then repeating: text (NUL-terminated) + timestamp(4, ms)
          const e = body[0]
          const wide = e === 1 || e === 2
          let q = 6
          if (wide) { while (q + 1 < body.length && !(body[q] === 0 && body[q + 1] === 0)) q += 2; q += 2 }
          else { while (q < body.length && body[q] !== 0) q++; q += 1 }
          const lines: string[] = []
          while (q < body.length - 4) {
            let z = q
            if (wide) { while (z + 1 < body.length && !(body[z] === 0 && body[z + 1] === 0)) z += 2 }
            else { while (z < body.length && body[z] !== 0) z++ }
            const text = decodeWith(e, body.subarray(q, z + (wide ? 0 : 1))).replace(/\0+$/, '').trim()
            const t = z + (wide ? 2 : 1)
            if (t + 4 > body.length) break
            const ms = ((body[t] << 24) | (body[t + 1] << 16) | (body[t + 2] << 8) | body[t + 3]) >>> 0
            q = t + 4
            if (!text) continue
            const mm = Math.floor(ms / 60000)
            const ss = Math.floor((ms % 60000) / 1000)
            const cs = Math.floor((ms % 1000) / 10)
            lines.push(`[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}]${text}`)
          }
          // SYLT is the good case: it arrives as real timestamps
          if (lines.length) tags.lyrics = lines.join('\n')
          break
        }
        case 'APIC': case 'PIC': {
          if (tags.picture) break
          const e = body[0]
          let q = 1
          let mime = 'image/jpeg'
          if (id === 'APIC') {
            let z = q
            while (z < body.length && body[z] !== 0) z++
            mime = latin1(body.subarray(q, z)) || 'image/jpeg'
            q = z + 1
          } else {
            mime = 'image/' + latin1(body.subarray(1, 4)).toLowerCase()
            q = 4
          }
          q += 1 // picture type
          if (e === 1 || e === 2) { while (q + 1 < body.length && !(body[q] === 0 && body[q + 1] === 0)) q += 2; q += 2 }
          else { while (q < body.length && body[q] !== 0) q++; q += 1 }
          const data = body.subarray(q)
          if (data.length > 128) tags.picture = { blob: new Blob([data.slice()]), mime }
          break
        }
      }
    } catch { /* skip malformed frame */ }
    p += hdr + fsize
  }
  return tags
}

function parseID1(buf: ArrayBuffer): AudioTags {
  const u8 = new Uint8Array(buf)
  if (u8.length < 128) return {}
  const s = u8.length - 128
  if (latin1(u8.subarray(s, s + 3)) !== 'TAG') return {}
  const fld = (a: number, b: number) => latin1(u8.subarray(s + a, s + b)).replace(/\0.*$/, '').trim()
  return {
    title: fld(3, 33) || undefined,
    artist: fld(33, 63) || undefined,
    album: fld(63, 93) || undefined,
    year: parseInt(fld(93, 97), 10) || undefined,
  }
}

function parseFlac(buf: ArrayBuffer): AudioTags {
  const u8 = new Uint8Array(buf)
  if (latin1(u8.subarray(0, 4)) !== 'fLaC') return {}
  const tags: AudioTags = {}
  let p = 4
  while (p + 4 <= u8.length) {
    const head = u8[p]
    const last = (head & 0x80) !== 0
    const type = head & 0x7f
    const len = (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]
    if (type === 4) { // VORBIS_COMMENT
      const dv = new DataView(buf)
      let q = p + 4
      const vl = dv.getUint32(q, true); q += 4 + vl
      const count = dv.getUint32(q, true); q += 4
      for (let i = 0; i < count && q + 4 <= u8.length; i++) {
        const l = dv.getUint32(q, true); q += 4
        const entry = utf8(u8.subarray(q, q + l)); q += l
        const eq = entry.indexOf('=')
        if (eq < 0) continue
        const key = entry.slice(0, eq).toUpperCase()
        const val = entry.slice(eq + 1)
        if (key === 'TITLE') tags.title = val
        else if (key === 'ARTIST') tags.artist ||= val
        else if (key === 'ALBUM') tags.album = val
        else if (key === 'ALBUMARTIST') tags.albumArtist = val
        else if (key === 'GENRE') tags.genre = val
        else if (key === 'DATE' && !tags.year) tags.year = parseInt(val.slice(0, 4), 10) || undefined
        else if (key === 'TRACKNUMBER') tags.track = parseInt(val, 10) || undefined
        else if (key === 'DISCNUMBER') tags.disc = parseInt(val, 10) || undefined
      }
    } else if (type === 6 && !tags.picture) { // PICTURE
      const dv = new DataView(buf)
      let q = p + 4
      q += 4 // picture type
      const ml = dv.getUint32(q); q += 4
      const mime = latin1(u8.subarray(q, q + ml)); q += ml
      const dl = dv.getUint32(q); q += 4 + dl
      q += 16 // w,h,depth,colors
      const pl = dv.getUint32(q); q += 4
      if (pl > 0 && q + pl <= u8.length) {
        tags.picture = { blob: new Blob([u8.slice(q, q + pl)]), mime: mime || 'image/jpeg' }
      }
    }
    p += 4 + len
    if (last) break
  }
  return tags
}

function parseM4A(buf: ArrayBuffer): AudioTags {
  const u8 = new Uint8Array(buf)
  const tags: AudioTags = {}
  const dv = new DataView(buf)
  // locate 'ilst' atom (usually inside moov near the start or middle)
  const limit = Math.min(u8.length, 1_500_000)
  let ilst = -1
  for (let i = 4; i < limit - 8; i++) {
    if (u8[i] === 0x69 && u8[i + 1] === 0x6c && u8[i + 2] === 0x73 && u8[i + 3] === 0x74) { ilst = i; break }
  }
  if (ilst < 0) return tags
  // walk children of ilst: each item is size + name ('©nam','©ART','©alb','covr','aART','©day','©gen','trkn','disk')
  let p = ilst + 4
  const name = (o: number) => latin1(u8.subarray(o, o + 4))
  const strAt = (child: number): string => {
    // child: offset of 'data' atom; payload = size + 'data' + flags(8) + text
    const size = u32(dv, child)
    const text = utf8(u8.subarray(child + 16, child + size)).replace(/\0+$/, '').trim()
    return text
  }
  while (p + 8 <= limit) {
    const size = u32(dv, p)
    if (size < 8) break
    const kind = name(p + 4)
    // find 'data' child
    let q = p + 8
    let dataOff = -1
    while (q + 8 <= p + size) {
      const ds = u32(dv, q)
      if (ds < 8) break
      if (name(q + 4) === 'data') { dataOff = q; break }
      q += ds
    }
    if (dataOff >= 0) {
      try {
        switch (kind) {
          case '\u00a9nam': tags.title = strAt(dataOff); break
          case '\u00a9ART': tags.artist = strAt(dataOff); break
          case 'aART': tags.albumArtist = strAt(dataOff); break
          case '\u00a9alb': tags.album = strAt(dataOff); break
          case '\u00a9gen': case 'gnre': tags.genre = strAt(dataOff); break
          case '\u00a9day': tags.year = parseInt(strAt(dataOff).slice(0, 4), 10) || undefined; break
          case 'trkn': tags.track = dv.getUint8(dataOff + 18); break
          case 'disk': tags.disc = dv.getUint8(dataOff + 18); break
          case 'covr': {
            const ds = u32(dv, dataOff)
            const payload = u8.subarray(dataOff + 16, dataOff + ds)
            if (payload.length > 128) tags.picture = { blob: new Blob([payload.slice()]), mime: 'image/jpeg' }
            break
          }
        }
      } catch { /* skip */ }
    }
    p += size
  }
  return tags
}

/**
 * Lyrics that live outside ID3: FLAC/OGG put them in a Vorbis comment, and
 * M4A/MP4 in a `©lyr` atom. Both are scanned for here rather than inside the
 * format parsers, so a track that carries words is picked up whichever
 * container it uses.
 */
export function extractEmbeddedLyrics(buf: ArrayBuffer): string | undefined {
  const u8 = new Uint8Array(buf)
  const hay = latin1(u8.subarray(0, Math.min(u8.length, 1_600_000)))

  // Vorbis comment: LYRICS= / UNSYNCEDLYRICS= (FLAC, OGG). No leading anchor:
  // comments are length-prefixed and run back to back, so the byte before the
  // key is whatever the previous comment ended with, not a separator.
  const vorbis = hay.match(/(?:UNSYNCED)?LYRICS=([^\x00]{2,})/i)
  if (vorbis && vorbis[1] && vorbis[1].trim().length > 2) return vorbis[1].trim()

  // MP4 atom ©lyr: '©lyr' + size + 'data' + flags + reserved + utf8 payload
  const mark = hay.indexOf('\u00a9lyr')
  if (mark >= 0) {
    const dv = new DataView(buf)
    // walk forward looking for the 'data' sub-atom, then read its payload
    for (let p = mark + 4; p < Math.min(mark + 64, u8.length - 12); p++) {
      if (latin1(u8.subarray(p, p + 4)) === 'data') {
        const len = ((u8[p + 4] << 24) | (u8[p + 5] << 16) | (u8[p + 6] << 8) | u8[p + 7]) >>> 0
        const start = p + 12
        const end = Math.min(start + Math.min(len, 200_000), u8.length)
        if (end - start > 2) {
          const text = utf8(u8.subarray(start, end)).replace(/\0+$/, '').trim()
          if (text.length > 2) return text
        }
      }
      // also accept a length-prefixed payload directly after the atom header
      const direct = ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0
      if (direct > 4 && direct < 200_000 && p + 4 + direct <= u8.length) {
        const text = utf8(u8.subarray(p + 4, p + 4 + direct)).replace(/\0+$/, '').trim()
        if (text.length > 2) return text
      }
    }
  }
  return undefined
}

/** Read tags from a File/Blob (reads at most ~1.6 MB from the head + 128-byte tail). */
export async function readTags(file: File | Blob): Promise<AudioTags> {
  try {
    const headSize = Math.min(file.size, 1_600_000)
    const head = await file.slice(0, headSize).arrayBuffer()
    const name = (file as File).name ?? ''
    let tags: AudioTags = {}
    if (name.toLowerCase().endsWith('.mp3') || headSize >= 10) {
      const id3 = parseID3(head)
      if (Object.keys(id3).length) tags = id3
    }
    if (!tags.title && latin1(new Uint8Array(head).subarray(0, 4)) === 'fLaC') {
      tags = { ...parseFlac(head), ...tags }
    }
    if (!tags.title && !tags.picture) {
      tags = { ...parseM4A(head), ...tags }
    }
    if (!tags.title && name.toLowerCase().endsWith('.mp3') && file.size > 128) {
      const tail = await file.slice(file.size - 128).arrayBuffer()
      tags = { ...parseID1(tail), ...tags }
    }
    // whatever the container, a track that carries its own words should find them
    if (!tags.lyrics) {
      const embedded = extractEmbeddedLyrics(head)
      if (embedded) tags.lyrics = embedded
    }
    return tags
  } catch {
    return {}
  }
}

/** "01 Artist - Title.mp3" / "Artist - Title" → { artist, title } */
export function parseFromFilename(filename: string): { artist?: string; title?: string } {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/^\s*\d+[\s.\-_]+/, '').trim()
  const m = base.split(/\s+-\s+/)
  if (m.length >= 2) return { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() }
  return { title: base }
}

export async function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement('audio')
    el.preload = 'metadata'
    let settled = false
    const done = (d: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      el.onloadedmetadata = null
      el.onerror = null
      // release the element's own buffer as well as the blob URL's reader
      el.removeAttribute('src')
      el.load()
      resolve(d)
    }
    // a folder of hundreds of files probes four at a time: a timer left behind
    // per file keeps a detached <audio> alive for the whole scan and beyond
    const timer = setTimeout(() => done(isFinite(el.duration) ? el.duration : 0), 8000)
    el.onloadedmetadata = () => done(isFinite(el.duration) ? el.duration : 0)
    el.onerror = () => done(0)
    el.src = url
  })
}
