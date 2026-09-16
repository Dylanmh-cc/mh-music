import { useMemo } from 'react'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton } from '../components/glass/GlassPanel'
import { IconPlay, IconHeart, IconDisc, IconArtist, IconList, IconFolder, IconImport, IconSparkle } from '../components/icons'
import { greeting } from '../lib/format'
import { rgba } from '../lib/color'
import type { Album, Song, Artist, Playlist } from '../types/models'

/**
 * Browse — the library as a set of shelves.
 *
 * The homepage is the room: a turntable and one long rack. This is the other
 * half of the pair — a scannable index of everything the library holds, one
 * shelf per way of looking at it. Every shelf scrolls horizontally and every
 * card is a real destination.
 */
export function BrowsePage() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)

  const recentlyAdded = useMemo(
    () => lib.albums.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 14),
    [lib.albums],
  )
  const featured = useMemo(
    // "featured" is deterministic, not random: the albums with the most tracks
    // are the ones worth surfacing first
    () => lib.albums.slice().sort((a, b) => b.songIds.length - a.songIds.length).slice(0, 14),
    [lib.albums],
  )
  const recentTracks = useMemo(() => {
    const seen = new Set<string>()
    const out: Song[] = []
    for (let i = lib.history.length - 1; i >= 0 && out.length < 14; i--) {
      const id = lib.history[i].songId
      if (seen.has(id)) continue
      seen.add(id)
      const s = lib.getSong(id)
      if (s) out.push(s)
    }
    return out
  }, [lib.history, lib.getSong])
  const favAlbums = useMemo(
    () => lib.favorites.albums.map((id) => lib.getAlbum(id)).filter((a): a is Album => !!a).slice(0, 14),
    [lib.favorites.albums, lib.getAlbum],
  )
  const artists = useMemo(
    () => lib.artists.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 14),
    [lib.artists],
  )
  const playlists = lib.playlists.slice(0, 14)

  if (!lib.songs.length) {
    return (
      <GlassPanel tier="soft" className="grid place-items-center rounded-3xl p-12 text-center">
        <div className="max-w-[420px]">
          <IconSparkle size={26} />
          <h2 className="mh-display mt-4 text-[22px]">Your music space is empty.</h2>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            Add a folder of music, or bring a playlist over from another player.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <GlassButton variant="accent" onClick={() => { navigate('folders'); pushPath('/folders') }}>
              <IconFolder size={15} /> Add Music Folder
            </GlassButton>
            <GlassButton onClick={() => { navigate('import'); pushPath('/import') }}>
              <IconImport size={15} /> Import Playlist
            </GlassButton>
          </div>
        </div>
      </GlassPanel>
    )
  }

  return (
    <div className="pb-6">
      <header className="pl-1">
        <p className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{greeting(user?.name)}</p>
        <h1 className="mh-display mt-1.5 text-[30px] md:text-[36px]">Browse</h1>
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
          {lib.albums.length} albums · {lib.songs.length} tracks · {lib.artists.length} artists · {lib.playlists.length} playlists
        </p>
      </header>

      <Shelf title="Recently Added" hint="The newest records in the rack">
        {recentlyAdded.map((a) => <AlbumCard key={a.id} album={a} />)}
      </Shelf>

      <Shelf title="Featured Albums" hint="The fullest records here">
        {featured.map((a) => <AlbumCard key={a.id} album={a} />)}
      </Shelf>

      {recentTracks.length > 0 && (
        <Shelf title="Recently Played" hint="Pick up where you stopped">
          {recentTracks.map((s) => (
            <TrackCard
              key={s.id}
              song={s}
              onPlay={() => player.playSong(s.id, recentTracks.map((x) => x.id), 'Recently played')}
            />
          ))}
        </Shelf>
      )}

      {favAlbums.length > 0 && (
        <Shelf title="Favorites" hint="What you keep coming back to">
          {favAlbums.map((a) => <AlbumCard key={a.id} album={a} />)}
        </Shelf>
      )}

      {playlists.length > 0 && (
        <Shelf title="My Playlists" hint="Sets you built by hand">
          {playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
        </Shelf>
      )}

      {artists.length > 0 && (
        <Shelf title="Artists" hint="Everyone in the library">
          {artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
        </Shelf>
      )}
    </div>
  )
}

function Shelf({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.length : 1
  if (!count) return null
  return (
    <section className="mt-9" aria-label={title}>
      <div className="mb-3 pl-1">
        <h2 className="mh-display text-[17px]">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</p>}
      </div>
      <div className="mh-shelf">{children}</div>
    </section>
  )
}

function AlbumCard({ album }: { album: Album }) {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)
  const playing = lib.songs.find((s) => s.id === player.songId)?.albumId === album.id

  const open = () => { navigate('album', { albumId: album.id }); pushPath(`/album/${album.id}`) }
  const play = () => {
    const first = album.songIds[0]
    if (first) player.playSong(first, album.songIds, album.name)
  }

  return (
    <div className="mh-shelf-card">
      <button
        className="block w-full overflow-hidden rounded-2xl"
        style={{ boxShadow: `0 18px 40px rgba(0,0,0,0.5), 0 0 40px ${rgba(album.palette.primary, playing ? 0.5 : 0.16)}` }}
        onClick={play}
        onDoubleClick={open}
        aria-label={`Play ${album.name}`}
      >
        <img src={album.coverUrl} alt="" loading="lazy" draggable={false} className="aspect-square w-full object-cover" />
      </button>
      <div className="mt-2.5 flex items-center gap-1.5">
        <button className="min-w-0 flex-1 text-left" onClick={open}>
          <span className="block truncate text-[13.5px] font-medium leading-tight">{album.name}</span>
          <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>{album.artist}</span>
        </button>
        {playing && <span className="eq-bars shrink-0" aria-hidden="true"><i /><i /><i /></span>}
      </div>
    </div>
  )
}

function TrackCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  const lib = useLibraryStore()
  const album = lib.getAlbum(song.albumId)
  const fav = lib.favorites.songs.includes(song.id)
  return (
    <div className="mh-shelf-card">
      <button className="relative block w-full overflow-hidden rounded-2xl" onClick={onPlay} aria-label={`Play ${song.title}`}>
        <img src={song.coverUrl} alt="" loading="lazy" draggable={false} className="aspect-square w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8 text-left">
          <IconPlay size={14} />
          <span className="truncate text-[11.5px] font-medium" style={{ color: 'rgba(255,255,255,0.92)' }}>{song.title}</span>
        </span>
      </button>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium leading-tight">{song.title}</span>
          <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
            {song.artist}{album ? ` · ${album.name}` : ''}
          </span>
        </span>
        <button
          className="shrink-0"
          onClick={() => lib.toggleFavSong(song.id)}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          style={{ color: fav ? 'var(--c-accent-2)' : 'var(--c-ink-faint)' }}
        >
          <IconHeart size={15} />
        </button>
      </div>
    </div>
  )
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const lib = useLibraryStore()
  const navigate = useUiStore((s) => s.navigate)
  const cover = playlist.songIds.length ? lib.getSong(playlist.songIds[0])?.coverUrl : undefined
  return (
    <div className="mh-shelf-card">
      <button
        className="relative block w-full overflow-hidden rounded-2xl"
        onClick={() => { navigate('playlist', { playlistId: playlist.id }); pushPath(`/playlist/${playlist.id}`) }}
        aria-label={`Open ${playlist.name}`}
      >
        {cover
          ? <img src={cover} alt="" loading="lazy" draggable={false} className="aspect-square w-full object-cover" />
          : <span className="grid aspect-square w-full place-items-center" style={{ background: 'var(--c-tint)' }}><IconList size={26} /></span>}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] backdrop-blur-md" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {playlist.songIds.length} tracks
        </span>
      </button>
      <span className="mt-2.5 block truncate text-[13.5px] font-medium">{playlist.name}</span>
      <span className="mt-0.5 block text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>Playlist</span>
    </div>
  )
}

function ArtistCard({ artist }: { artist: Artist }) {
  const lib = useLibraryStore()
  const navigate = useUiStore((s) => s.navigate)
  const cover = lib.getAlbum(artist.albumIds[0])?.coverUrl
  return (
    <div className="mh-shelf-card">
      <button
        className="block w-full overflow-hidden rounded-full"
        onClick={() => { navigate('artist', { artistId: artist.id }); pushPath(`/artist/${artist.id}`) }}
        aria-label={`Open ${artist.name}`}
      >
        {cover
          ? <img src={cover} alt="" loading="lazy" draggable={false} className="aspect-square w-full rounded-full object-cover" />
          : <span className="grid aspect-square w-full place-items-center rounded-full" style={{ background: 'var(--c-tint)' }}><IconArtist size={26} /></span>}
      </button>
      <div className="mt-2.5 text-center">
        <span className="block truncate text-[13.5px] font-medium">{artist.name}</span>
        <span className="mt-0.5 block text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>
          {artist.albumIds.length} album{artist.albumIds.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}

export { IconDisc }
