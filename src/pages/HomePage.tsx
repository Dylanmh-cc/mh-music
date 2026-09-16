import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton, IconButton } from '../components/glass/GlassPanel'
import { Deck3D } from '../components/album/Deck3D'
import { SongStack } from '../components/album/SongStack'
import { UpNextHeader, UpNextList } from '../components/UpNextList'
import { IconPlay, IconPause, IconNext, IconPrev, IconHeart, IconHeartFill, IconMore, IconFolder, IconImport, IconVinyl, IconChevronLeft, IconChevronRight, IconSearch, IconDisc } from '../components/icons'
import { confirmDeleteAlbum } from '../components/confirmActions'
import { greeting, cn } from '../lib/format'
import { rgba } from '../lib/color'

/**
 * The rebuilt homepage: a turntable parked at the top, then every album in one
 * horizontal row.
 *
 * The deck is the page's anchor — it holds the record of whatever is playing,
 * so the answer to "what is on?" is physical rather than a label. Below it the
 * whole library runs left to right in a single band, still in the shared 3D
 * room (per-sleeve depth and yaw, the plane drifting against the pointer) but
 * never wrapping onto a second line.
 */
export function HomePage() {
  const lib = useLibraryStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useUiStore((s) => s.navigate)

  const albums = useMemo(
    () => lib.albums.slice().sort((x, y) => x.name.localeCompare(y.name)),
    [lib.albums],
  )

  if (!lib.songs.length) {
    return <EmptyUniverse onAdd={() => navigate('folders')} onImport={() => navigate('folders')} />
  }

  return (
    <div className="relative pb-40">
      <DeckSection name={user?.name} albums={albums.length} tracks={lib.songs.length} />
      <AlbumRow albums={albums} />
      <div className="h-24" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  The deck: a dedicated area at the very top of the page             */
/* ------------------------------------------------------------------ */

/**
 * The turntable block. The record on the platter is the album the listener is
 * currently on — its cover is the record's label — and it is only turning, with
 * the stylus only down, while the transport is actually running.
 */
function DeckSection({ name, albums, tracks }: { name?: string; albums: number; tracks: number }) {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)
  const song = lib.getSong(player.songId ?? '')
  const album = song ? lib.getAlbum(song.albumId) : undefined
  const playing = !!album && player.isPlaying
  // What the stack on the right shows: the record that is on, in album order,
  // or — before anything is playing — the first few tracks of the library.
  const stackSongs = useMemo(() => {
    const ids = album ? album.songIds : lib.songs.slice(0, 5).map((s) => s.id)
    return ids.map((id) => lib.getSong(id)).filter((s): s is NonNullable<typeof s> => !!s)
  }, [album, lib.songs, lib.getSong])
  const deckRef = useRef<HTMLDivElement | null>(null)

  // the deck leans a little further as the pointer crosses the page, which is
  // what sells it as a solid object rather than a picture of one
  useEffect(() => {
    const el = deckRef.current
    if (!el) return
    let raf = 0
    let tx = 0, cx = 0, ty = 0, cy = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const tick = () => {
      cx += (tx - cx) * 0.05
      cy += (ty - cy) * 0.05
      el.style.setProperty('--deck-x', `${(cx * 22).toFixed(2)}px`)
      el.style.setProperty('--deck-y', `${(cy * 12).toFixed(2)}px`)
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <section className="relative px-1 pb-2 pt-5 md:pt-6" aria-label="Turntable">
      {/* two columns: the title, deck and transport on the left; the search,
          the playing card and the queue on the right, starting at the top */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-7">
        <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{greeting(name)}</p>
          <h1 className="mh-display mt-1.5 text-[30px] leading-[1.1] md:text-[40px]">
            Music Beyond Sound<span style={{ color: 'var(--c-accent-2)' }}>.</span>
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            {albums} albums · {tracks} tracks · now spinning:{' '}
            <span style={{ color: 'var(--c-ink)' }}>{album ? `${album.name} — ${album.artist}` : 'nothing yet'}</span>
          </p>
        </div>
      </div>

      {/* the deck itself — the same modelled 3D machine the opening builds,
          standing still on the page and behaving like a real one */}
      <div ref={deckRef} className="relative mt-2 md:mt-3" style={{ transform: 'translate3d(var(--deck-x,0), var(--deck-y,0), 0)' }}>
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-7">
          {/* The sleeve's column is always here, whether or not a record is on.
              It used to appear only once something played, which pushed the deck
              sideways the moment you pressed play — the machine must not move.
              When nothing is loaded the slot holds a quiet placeholder. */}
          <figure className="relative w-[clamp(200px,30vh,360px)] shrink-0 text-center">
            {album ? (
              <>
                {/* the album's own light pooling behind the sleeve */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[10%] rounded-[12%]"
                  style={{ background: `radial-gradient(circle, ${rgba(album.palette.primary, 0.5)}, transparent 70%)`, filter: 'blur(30px)' }}
                />
                <img
                  src={album.coverUrl}
                  alt={`${album.name} artwork`}
                  draggable={false}
                  className="relative block w-full rounded-2xl object-cover"
                  style={{
                    aspectRatio: '1',
                    boxShadow: '0 30px 68px rgba(0,0,0,0.66), 0 10px 24px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.16)',
                  }}
                />
              </>
            ) : (
              <span
                className="relative grid w-full place-items-center rounded-2xl"
                style={{
                  aspectRatio: '1',
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px dashed rgba(255,255,255,0.12)',
                }}
              >
                <span className="flex flex-col items-center gap-2" style={{ color: 'var(--c-ink-faint)' }}>
                  <IconVinyl size={30} />
                  <span className="text-[11.5px]">Nothing on the platter</span>
                </span>
              </span>
            )}
            <figcaption className="mt-3 w-full">
              <span className="block truncate text-[13.5px] font-medium">{album?.name ?? 'Ready when you are'}</span>
              <span className="mt-0.5 block truncate text-[12px]" style={{ color: 'var(--c-ink-dim)' }}>
                {album?.artist ?? 'Pick a sleeve from the rack'}
              </span>
            </figcaption>
          </figure>

          {/* The deck's frame is a fixed part of the composition: it takes the
              height the band gives it, and the width follows the aspect ratio.
              The transport is a child of this column, so it is centred on the
              machine rather than on the whole left column. */}
          <div className="flex flex-col items-center gap-3">
          <div className="relative w-auto" style={{ height: 'min(45vh, 405px)', aspectRatio: '3 / 2' }}>
            <Deck3D
              className="absolute inset-0"
              cover={album?.coverUrl}
              playing={playing}
              accent={album?.palette.primary}
            />

            {/* spindle light spilling onto the page under the deck */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -bottom-2 h-24"
              style={{
                background: `radial-gradient(50% 100% at 50% 0%, ${album ? rgba(album.palette.primary, 0.34) : 'rgba(120,150,220,0.2)'}, transparent 72%)`,
                filter: 'blur(26px)',
              }}
            />
          </div>

          {/* transport, centred on the deck above it */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <IconButton label="Previous" className="h-14 w-14" onClick={() => player.prev()}><IconPrev size={24} /></IconButton>
            <button
              className="lg-btn lg-btn-primary grid h-16 w-16 place-items-center rounded-full"
              onClick={player.toggle}
              disabled={!album}
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
            >
              {player.isPlaying ? <IconPause size={25} /> : <IconPlay size={25} />}
            </button>
            <IconButton label="Next" className="h-14 w-14" onClick={() => player.next()}><IconNext size={24} /></IconButton>
            {album && (
              <span className="ml-1 flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className={cn('eq-bars', !player.isPlaying && 'eq-paused')} aria-hidden="true"><i /><i /><i /></span>
                <span className="truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)', maxWidth: 220 }}>
                  {song?.title ?? album.name}
                </span>
              </span>
            )}
          </div>
          </div>

        </div>
      </div>

        </div>

        {/* The right-hand column starts at the top of the page rather than at
            the top of the deck, so the search field lands on the title's line —
            the greeting's own line is held open here to keep the two aligned
            without a hand-tuned offset. */}
        <div className="flex w-full max-w-[340px] shrink-0 flex-col gap-4">
          {/* the greeting's line, held open, then the field — one group, so the
              column's own gap cannot push the field off the title's line */}
          <div className="flex flex-col">
            <span className="mh-overline invisible hidden md:block" aria-hidden="true">{greeting(name)}</span>
            <div className="mt-1.5">
              <SearchBar />
            </div>
          </div>
          {stackSongs.length > 0 && (
            <SongStack songs={stackSongs} albumName={album?.name} />
          )}
          <div className="flex flex-col">
            <UpNextHeader />
            {/* a fixed height, so one more or one fewer track in the queue
                cannot change the height of the page */}
            <UpNextList className="h-[176px] overflow-y-auto pr-1" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Every album, in one row                                            */
/* ------------------------------------------------------------------ */

/**
 * One horizontal band for the whole library — Z to A order preserved, but no
 * wrapping and no per-letter sections. The row scrolls under its own inertia
 * and snaps to whole sleeves; the arrows page it.
 */
function AlbumRow({ albums }: { albums: ReturnType<typeof useLibraryStore.getState>['albums'] }) {
  const planeRef = useRef<HTMLDivElement | null>(null)

  // the plane drifts against the pointer: same room, now across several rows
  useEffect(() => {
    const el = planeRef.current
    if (!el) return
    let raf = 0
    let tx = 0, ty = 0, cx = 0, cy = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.setProperty('--gx', `${(-cx * 14).toFixed(2)}px`)
      el.style.setProperty('--gy', `${(-cy * 9).toFixed(2)}px`)
      el.style.setProperty('--gyaw', `${(cx * 1.8).toFixed(2)}deg`)
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <section className="relative mt-12" aria-label="All albums">
      <div className="mb-5 pl-1">
        <h2 className="mh-display text-[19px]">All Albums</h2>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          {albums.length} in the rack · click a sleeve to put it on the deck
        </p>
      </div>

      {/* Seven to a row, and every album past seven starts the next row — the
          rack grows downwards, so the page scrolls instead of running sideways. */}
      <div className="mh-gallery-scene px-1 pb-6 pt-2">
        <div
          ref={planeRef}
          className="mh-gallery-plane mh-gallery grid grid-cols-3 gap-x-5 gap-y-9 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 lg:gap-x-6"
          style={{ transform: 'translate3d(var(--gx,0), var(--gy,0), 0) rotateY(var(--gyaw,0))' }}
        >
          {albums.map((album, i) => (
            <GallerySleeve key={album.id} album={album} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function GallerySleeve({ album, index }: {
  album: ReturnType<typeof useLibraryStore.getState>['albums'][number]; index: number
}) {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const fav = lib.favorites.albums.includes(album.id)
  const playingThis = lib.songs.find((s) => s.id === player.songId)?.albumId === album.id

  // each sleeve hangs at its own depth and yaw — that is what makes the row a room
  // Each sleeve hangs at its own depth and yaw — that is what makes the rack a
  // room. The ladder starts *above* zero: a card sitting exactly on the plane's
  // own z is coplanar with it, and Chrome's 3D hit-testing then hands the click
  // to the plane, which is why the first sleeve alone stopped responding.
  const tz = 22 + ((index * 37) % 5) * 22
  const ry = ((index * 53) % 5 - 2) * 1.6
  const delay = -((index * 31) % 90) / 10

  const open = () => { ui.navigate('album', { albumId: album.id }); pushPath(`/album/${album.id}`) }
  const play = () => {
    const first = album.songIds[0]
    if (first) player.playSong(first, album.songIds, album.name)
  }

  return (
    <div
      className="mh-gallery-card group pointer-events-auto w-full min-w-0"
      style={{ transform: `translateZ(${tz}px) rotateY(${ry}deg)` }}
      // The whole card plays, not just the sleeve: in a 3D-transformed grid the
      // card box itself can end up on top at some points, and a click there used
      // to land on nothing at all.
      role="button"
      tabIndex={0}
      aria-label={`Play ${album.name} by ${album.artist}`}
      onClick={play}
      onDoubleClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play() }
      }}
    >
      <button
        className="relative block w-full"
        style={{ transformStyle: 'preserve-3d' }}
        // pointer play is handled by the card itself; this stays as the keyboard
        // target, and its click is left to bubble (once) rather than firing twice
        tabIndex={-1}
        aria-hidden="true"
      >
        {/* the album's own light pooling behind the sleeve, brightest when it is
            the record currently on the platter */}
        <span
          className="mh-halo"
          style={{ background: `radial-gradient(circle, ${rgba(album.palette.primary, 0.62)}, transparent 70%)`, opacity: playingThis ? 0.9 : 0 }}
        />
        <motion.span
          className="relative block overflow-hidden rounded-[5%]"
          style={{
            aspectRatio: '1',
            boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 10px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16)',
          }}
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 9 + (index % 5), repeat: Infinity, ease: 'easeInOut', delay }}
        >
          <img src={album.coverUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
          {/* the sheen across the laminate */}
          <span className="pointer-events-none absolute inset-0 rounded-[5%]" style={{ background: 'linear-gradient(148deg, rgba(255,255,255,0.14), transparent 32%, transparent 74%, rgba(255,255,255,0.05))' }} />
          {/* whatever is on the platter is marked on the sleeve in the rack */}
          {playingThis && (
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
              <span className={cn('eq-bars', !player.isPlaying && 'eq-paused')} aria-hidden="true"><i /><i /><i /></span>
              <span className="text-[10.5px] font-semibold tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.86)' }}>
                ON THE DECK
              </span>
            </span>
          )}
        </motion.span>
      </button>

      {/* controls appear only for the sleeve you are pointing at. Each one stops
          the click from reaching the card, or it would also start playback. */}
      <div className="mt-3 flex items-start gap-2">
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[14.5px] font-medium leading-tight">{album.name}</span>
          <span className="mt-0.5 block truncate text-[12px]" style={{ color: 'var(--c-ink-dim)' }}>
            {album.year ? `${album.year} · ` : ''}{album.artist}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <IconButton
            label={playingThis && player.isPlaying ? `Pause ${album.name}` : `Play ${album.name}`}
            className="h-9 w-9"
            onClick={(e) => { e.stopPropagation(); playingThis && player.isPlaying ? player.toggle() : play() }}
          >
            {playingThis && player.isPlaying ? <IconPause size={15} /> : <IconPlay size={15} />}
          </IconButton>
          <IconButton label={`Open the ${album.name} album page`} className="h-9 w-9" onClick={(e) => { e.stopPropagation(); open() }}>
            <IconDisc size={15} />
          </IconButton>
          <IconButton
            label={fav ? 'Remove from favorites' : 'Add to favorites'}
            className="h-9 w-9"
            active={fav}
            onClick={(e) => { e.stopPropagation(); lib.toggleFavAlbum(album.id) }}
          >
            {fav ? <IconHeartFill size={15} /> : <IconHeart size={15} />}
          </IconButton>
          <IconButton
            label={`More options for ${album.name}`}
            className="h-9 w-9"
            onClick={(e) => {
              e.stopPropagation()
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              ui.openCtx(r.left - 210, r.bottom + 6, [
                { label: 'Open Album', action: open },
                { label: 'Play Album', action: play },
                { sep: true },
                { label: fav ? 'Remove from Favorites' : 'Add to Favorites', action: () => lib.toggleFavAlbum(album.id) },
                { sep: true },
                { label: 'Delete Album', danger: true, action: () => confirmDeleteAlbum(album) },
              ])
            }}
          >
            <IconMore size={15} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

/** The search field in the page header. It reads as an input, and opens the
 *  shared search overlay — which already has the live results, the grouping and
 *  the keyboard handling — rather than being a second, competing search box. */
function SearchBar() {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const lib = useLibraryStore()
  return (
    <button
      className="glass-soft flex h-11 w-full items-center gap-2.5 rounded-full px-4 text-left transition-colors duration-200 hover:bg-white/8"
      onClick={() => setSearchOpen(true)}
      aria-label="Search songs, artists, albums and playlists"
      title="Search — or press /"
    >
      <IconSearch size={16} />
      <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>
        Search songs, artists, albums…
      </span>
      <kbd className="mh-mono hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] md:block" style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--c-ink-faint)' }}>
        /
      </kbd>
      <span className="sr-only">{lib.songs.length} tracks in the library</span>
    </button>
  )
}

/** No music yet: a record turning in the dark, and the two ways in. */
function EmptyUniverse({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div className="max-w-[420px]">
        <motion.div
          className="relative mx-auto aspect-square w-[230px]"
          animate={{ y: [0, -12, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="vinyl vinyl-slow vinyl-paused absolute inset-0" />
          <span className="absolute inset-[33%] grid place-items-center rounded-full" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>
            <IconVinyl size={30} />
          </span>
        </motion.div>
        <h2 className="mh-display mt-8 text-[24px]">Your music space is empty.</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
          Point MH Music at a folder of music and the rack fills up. Tags, artwork and lyrics are read right here
          in your browser — nothing is uploaded.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <GlassButton variant="accent" size="lg" onClick={onAdd}><IconFolder size={15} /> Add Music Folder</GlassButton>
          <GlassButton size="lg" onClick={onImport}><IconImport size={15} /> Import Playlist</GlassButton>
        </div>
      </div>
    </div>
  )
}

export { GlassPanel }
