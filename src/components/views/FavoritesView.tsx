import { useMemo, useState } from 'react'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { EmptyState, SectionTitle, GlassButton, SongRow } from './shared'
import { Stage3D, StageCardBody } from '../stage/Stage3D'
import { ViewModeToggle, useViewMode } from './viewMode'
import { IconHeart, IconHeartFill, IconMore, IconPlay, IconPause, IconShuffle } from '../icons'
import { shuffle } from '../../lib/rand'
import { cn } from '../../lib/format'
import { songMenuItems } from '../songMenu'

type Sort = 'recent' | 'title' | 'artist'

/** Favourites on the 3D stage — songs first, then the albums and artists. */
export function FavoritesView() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const [sort, setSort] = useState<Sort>('recent')
  const mode = useViewMode('favorites')
  const [hover, setHover] = useState<string | null>(null)

  const favSongs = useMemo(() => {
    const songs = lib.favorites.songs.map((id) => lib.getSong(id)!).filter(Boolean)
    if (sort === 'title') return songs.slice().sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'artist') return songs.slice().sort((a, b) => a.artist.localeCompare(b.artist))
    return songs
  }, [lib, sort])
  const favAlbums = lib.favorites.albums.map((id) => lib.getAlbum(id)!).filter(Boolean)
  const favArtists = lib.favorites.artists.map((id) => lib.getArtist(id)!).filter(Boolean)

  if (!favSongs.length && !favAlbums.length && !favArtists.length) {
    return (
      <EmptyState
        icon={<IconHeart size={28} />}
        title="Your favorites will appear here."
        hint="Tap the heart on any song or album and it will find its way to this room."
      />
    )
  }

  const contextIds = favSongs.map((s) => s.id)

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionTitle
        title="Favorites"
        hint={`${favSongs.length} song${favSongs.length !== 1 ? 's' : ''} · ${favAlbums.length} album${favAlbums.length !== 1 ? 's' : ''} · ${favArtists.length} artist${favArtists.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="glass-soft rounded-full bg-transparent px-3 py-1.5 text-[12px] outline-none"
              style={{ color: 'var(--c-ink-dim)' }}
              aria-label="Sort favorites"
            >
              <option value="recent" style={{ color: '#111' }}>Recently added</option>
              <option value="title" style={{ color: '#111' }}>Title</option>
              <option value="artist" style={{ color: '#111' }}>Artist</option>
            </select>
            {favSongs.length > 0 && (
              <>
                <GlassButton primary onClick={() => player.playSong(favSongs[0].id, contextIds, 'Favorites')}>
                  <span className="flex items-center gap-2"><IconPlay size={13} /> Play All</span>
                </GlassButton>
                <GlassButton onClick={() => {
                  const list = shuffle(favSongs)
                  player.playSong(list[0].id, list.map((s) => s.id), 'Favorites Shuffle')
                }}>
                  <span className="flex items-center gap-2"><IconShuffle size={13} /> Shuffle</span>
                </GlassButton>
              </>
            )}
            <ViewModeToggle page="favorites" />
          </div>
        }
      />

      {favSongs.length > 0 && mode === 'list' && (
        <div className="song-list mx-auto max-w-[980px]">
          {favSongs.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              index={i + 1}
              contextIds={contextIds}
              dimmed={!!hover && hover !== song.id}
              onHover={setHover}
            />
          ))}
        </div>
      )}

      {favSongs.length > 0 && mode === 'stage' && (
        <Stage3D
          items={favSongs}
          keyOf={(s) => s.id}
          label="Favorites stage"
          thumbnailOf={(s) => s.coverUrl}
          followKey={player.songId}
          onActivate={(song) => (player.songId === song.id ? player.toggle() : player.playSong(song.id, contextIds, 'Favorites'))}
          renderCard={(song) => {
            const album = lib.getAlbum(song.albumId)
            const isCurrent = player.songId === song.id
            const isPlaying = isCurrent && player.isPlaying
            const play = () => (isCurrent ? player.toggle() : player.playSong(song.id, contextIds, 'Favorites'))
            return (
              <StageCardBody
                artLabel={`${isPlaying ? 'Pause' : 'Play'} ${song.title}`}
                art={<img src={song.coverUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
                title={song.title}
                subtitle={`${song.artist} · ${album?.name ?? '—'}`}
                onActivate={play}
                actions={
                  <>
                    <span onClick={play} className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center" role="button" aria-label={isPlaying ? 'Pause' : 'Play'}>
                      {isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
                    </span>
                    <button
                      className="icon-btn active h-9 w-9"
                      style={{ color: 'var(--c-accent-2)' }}
                      onClick={(e) => { e.stopPropagation(); lib.toggleFavSong(song.id) }}
                      aria-label={`Remove ${song.title} from favorites`}
                    >
                      <IconHeartFill size={16} />
                    </button>
                    <button
                      className="icon-btn h-9 w-9"
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        ui.openCtx(r.left - 210, r.bottom + 6, songMenuItems(song))
                      }}
                      aria-label={`More options for ${song.title}`}
                    >
                      <IconMore size={15} />
                    </button>
                  </>
                }
              />
            )
          }}
        />
      )}

      {/* the album and artist favourites ride along underneath, in the same glass */}
      {(favAlbums.length > 0 || favArtists.length > 0) && (
        <div className="mt-8 flex flex-wrap gap-2.5">
          {favAlbums.map((a) => (
            <button
              key={a.id}
              onClick={() => ui.navigate('album', { albumId: a.id })}
              className="glass-soft flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-[12.5px] transition hover:bg-white/8"
            >
              <img src={a.coverUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="max-w-[160px] truncate">{a.name}</span>
            </button>
          ))}
          {favArtists.map((a) => (
            <span key={a.id} className={cn('glass-soft flex items-center gap-2 rounded-full py-1.5 pl-2 pr-2.5 text-[12.5px]')}>
              <button
                className="flex items-center gap-2"
                onClick={() => ui.navigate('artist', { artistId: a.id })}
                aria-label={`Open artist ${a.name}`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>
                  {a.name[0]}
                </span>
                <span className="max-w-[150px] truncate">{a.name}</span>
              </button>
              <button
                className="icon-btn h-7 w-7 active"
                style={{ color: 'var(--c-accent-2)' }}
                onClick={() => lib.toggleFavArtist(a.id)}
                aria-label={`Remove ${a.name} from favorites`}
              >
                <IconHeartFill size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="h-10" />
    </div>
  )
}
