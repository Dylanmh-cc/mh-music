import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '../../stores/ui'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { fuzzyScore } from '../../lib/fuzzy'
import { fmtTime, cn } from '../../lib/format'
import { IconSearch, IconNote, IconAlbum, IconArtist, IconList, IconPlay } from '../icons'
import { Stage3D, StageCardBody } from '../stage/Stage3D'
import type { Album, Artist, Playlist, Song } from '../../types/models'

const MIN = 2

export function SearchOverlay() {
  const open = useUiStore((s) => s.searchOpen)
  const setOpen = useUiStore((s) => s.setSearchOpen)
  const navigate = useUiStore((s) => s.navigate)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 140)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60)
    else setQ('')
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const results = useMemo(() => {
    if (debounced.trim().length < MIN) return null
    const songs = lib.songs
      .map((s) => ({ s, score: fuzzyScore(debounced, s.title) + fuzzyScore(debounced, s.artist) * 0.5 + (s.genre ? fuzzyScore(debounced, s.genre) * 0.3 : 0) + (s.year ? (String(s.year).includes(debounced) ? 8 : 0) : 0) }))
      .filter((x) => x.score > 12)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.s)
    const albums = lib.albums
      .map((a) => ({ a, score: fuzzyScore(debounced, a.name) + fuzzyScore(debounced, a.artist) * 0.6 + (a.genre ? fuzzyScore(debounced, a.genre) * 0.3 : 0) }))
      .filter((x) => x.score > 12)
      .sort((x, y) => y.score - x.score)
      .slice(0, 6)
      .map((x) => x.a)
    const artists = lib.artists
      .map((a) => ({ a, score: fuzzyScore(debounced, a.name) }))
      .filter((x) => x.score > 12)
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map((x) => x.a)
    const playlists = lib.playlists
      .map((p) => ({ p, score: fuzzyScore(debounced, p.name) }))
      .filter((x) => x.score > 12)
      .sort((x, y) => y.score - x.score)
      .slice(0, 4)
      .map((x) => x.p)
    const top = songs[0] ? { kind: 'song' as const, song: songs[0] } : albums[0] ? { kind: 'album' as const, album: albums[0] } : artists[0] ? { kind: 'artist' as const, artist: artists[0] } : null
    return { songs, albums, artists, playlists, top }
  }, [debounced, lib])

  /** one flat list so the results browse as a single 3D stage */
  const hits = useMemo(() => {
    if (!results) return []
    const out: Hit[] = [
      ...results.songs.map((song) => ({ kind: 'song' as const, song })),
      ...results.albums.map((album) => ({ kind: 'album' as const, album })),
      ...results.artists.map((artist) => ({ kind: 'artist' as const, artist })),
      ...results.playlists.map((playlist) => ({ kind: 'playlist' as const, playlist })),
    ]
    return out.slice(0, 24)
  }, [results])

  const close = () => setOpen(false)
  const go = (fn: () => void) => { close(); fn() }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-start justify-center px-4 pt-[9vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(2,3,6,0.55)', backdropFilter: 'blur(10px)' }} onClick={close} aria-hidden="true" />
          <motion.div
            className="glass-strong relative w-full max-w-[980px] overflow-hidden rounded-[26px]"
            initial={{ y: -22, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ y: -14, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label="Search your library"
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
              <IconSearch size={18} style={{ color: 'var(--c-accent-2)' }} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search songs, artists, albums, playlists…"
                className="flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-white/30"
                aria-label="Search query"
              />
              <kbd className="glass-soft rounded-lg px-2 py-1 text-[10.5px]" style={{ color: 'var(--c-ink-faint)' }}>Esc</kbd>
            </div>

            <div className="scroll-silk max-h-[62vh] p-4">
              {!results && (
                <div className="px-2 py-8 text-center text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>
                  Type at least {MIN} characters — fuzzy matching included.
                </div>
              )}
              {results && !results.songs.length && !results.albums.length && !results.artists.length && !results.playlists.length && (
                <div className="px-2 py-8 text-center text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>
                  Nothing found for “{debounced}”.
                </div>
              )}

              {hits.length > 0 && (
                <>
                  <SectionLabel>{`${hits.length} result${hits.length !== 1 ? 's' : ''}`}</SectionLabel>
                  <Stage3D
                    items={hits}
                    keyOf={(h) => hitKey(h)}
                    label="Search results"
                    thumbnailOf={(h) => hitCover(h, lib)}
                    cardWidth={264}
                    stageHeight={470}
                    className="mt-0"
                    onActivate={(h) => go(() => openHit(h, lib, player, navigate))}
                    renderCard={(h) => <HitCard hit={h} lib={lib} player={player} navigate={navigate} close={close} />}
                  />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 mt-1 px-2.5 text-[10.5px] uppercase tracking-[0.22em]" style={{ color: 'var(--c-ink-faint)' }}>{children}</div>
}

/* ── search hits: songs, albums, artists and playlists share one stage ────── */

type Hit =
  | { kind: 'song'; song: Song }
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: Artist }
  | { kind: 'playlist'; playlist: Playlist }

const hitKey = (h: Hit) =>
  h.kind === 'song' ? `s:${h.song.id}` : h.kind === 'album' ? `a:${h.album.id}` : h.kind === 'artist' ? `r:${h.artist.id}` : `p:${h.playlist.id}`

function hitCover(h: Hit, lib: ReturnType<typeof useLibraryStore.getState>): string | undefined {
  if (h.kind === 'song') return h.song.coverUrl
  if (h.kind === 'album') return h.album.coverUrl
  if (h.kind === 'artist') return lib.getAlbum(h.artist.albumIds[0])?.coverUrl
  return lib.getSong(h.playlist.songIds[0])?.coverUrl
}

function openHit(
  h: Hit,
  lib: ReturnType<typeof useLibraryStore.getState>,
  player: ReturnType<typeof usePlayerStore.getState>,
  navigate: (v: 'album' | 'artist' | 'playlist', p: Record<string, string>) => void,
) {
  if (h.kind === 'song') player.playSong(h.song.id, lib.songs.map((s) => s.id), 'Search')
  else if (h.kind === 'album') navigate('album', { albumId: h.album.id })
  else if (h.kind === 'artist') navigate('artist', { artistId: h.artist.id })
  else navigate('playlist', { playlistId: h.playlist.id })
}

function HitCard({ hit, lib, player, navigate, close }: {
  hit: Hit
  lib: ReturnType<typeof useLibraryStore.getState>
  player: ReturnType<typeof usePlayerStore.getState>
  navigate: (v: 'album' | 'artist' | 'playlist', p: Record<string, string>) => void
  close: () => void
}) {
  const cover = hitCover(hit, lib)
  const art = cover
    ? <img src={cover} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
    : <span className="grid h-full w-full place-items-center" style={{ background: 'linear-gradient(140deg, #1a1d26, #0d0f15)' }}><IconNote size={26} /></span>

  const label =
    hit.kind === 'song' ? 'Song' : hit.kind === 'album' ? 'Album' : hit.kind === 'artist' ? 'Artist' : 'Playlist'
  const title =
    hit.kind === 'song' ? hit.song.title : hit.kind === 'album' ? hit.album.name : hit.kind === 'artist' ? hit.artist.name : hit.playlist.name
  const sub =
    hit.kind === 'song' ? `${hit.song.artist} · ${fmtTime(hit.song.duration)}`
      : hit.kind === 'album' ? hit.album.artist
        : hit.kind === 'artist' ? `${hit.artist.albumIds.length} album${hit.artist.albumIds.length !== 1 ? 's' : ''}`
          : `${hit.playlist.songIds.length} track${hit.playlist.songIds.length !== 1 ? 's' : ''}`

  const go = () => { close(); openHit(hit, lib, player, navigate) }

  return (
    <StageCardBody
      artLabel={`Open ${title}`}
      art={art}
      title={title}
      subtitle={sub}
      sub2={label}
      onActivate={go}
      actions={
        <>
          <span onClick={go} className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center" role="button" aria-label={`Open ${title}`}>
            <IconPlay size={16} />
          </span>
          <span className="ml-auto pr-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--c-ink-faint)' }}>{label}</span>
        </>
      }
    />
  )
}
