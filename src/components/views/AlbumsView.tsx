import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { EmptyState, SectionTitle } from './shared'
import { Stage3D, StageCardBody } from '../stage/Stage3D'
import { ViewModeToggle, useViewMode, AlbumRow } from './viewMode'
import { confirmDeleteAlbum } from '../confirmActions'
import { IconAlbum, IconHeart, IconHeartFill, IconMore, IconPlay } from '../icons'
import { cn } from '../../lib/format'

/**
 * Albums on the 3D stage — the centred sleeve is the focus, its neighbours
 * recede in perspective. Opening an album is a click away, and the wall never
 * collapses into a plain grid or list.
 */
export function AlbumsView() {
  const albums = useLibraryStore((s) => s.albums)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()
  const mode = useViewMode('albums')

  if (!albums.length) {
    return <EmptyState icon={<IconAlbum size={30} />} title="No albums yet." hint="Albums appear here once your library has music." />
  }

  const sorted = albums.slice().sort((a, b) => a.name.localeCompare(b.name))
  const play = (album: (typeof albums)[number]) => {
    const first = album.songIds[0]
    if (first) player.playSong(first, album.songIds, album.name)
  }
  const menu = (album: (typeof albums)[number], el: HTMLElement) => {
    const fav = lib.favorites.albums.includes(album.id)
    const r = el.getBoundingClientRect()
    ui.openCtx(r.left - 210, r.bottom + 6, [
      { label: 'Open Album', action: () => ui.navigate('album', { albumId: album.id }) },
      { label: 'Play Album', action: () => play(album) },
      { sep: true },
      { label: fav ? 'Remove from Favorites' : 'Add to Favorites', action: () => lib.toggleFavAlbum(album.id) },
      { sep: true },
      { label: 'Delete Album', danger: true, action: () => confirmDeleteAlbum(album) },
    ])
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionTitle
        title="Albums"
        hint={`${albums.length} albums in your collection`}
        action={<ViewModeToggle page="albums" />}
      />

      {mode === 'list' ? (
        <div className="song-list mx-auto max-w-[980px]">
          {sorted.map((album, i) => (
            <AlbumRow
              key={album.id}
              album={album}
              index={i}
              onOpen={() => ui.navigate('album', { albumId: album.id })}
              onPlay={() => play(album)}
              onMore={(el) => menu(album, el)}
            />
          ))}
        </div>
      ) : (
        <Stage3D
        items={albums}
        keyOf={(a) => a.id}
        label="Album stage"
        thumbnailOf={(a) => a.coverUrl}
        cardWidth={320}
        stageHeight={560}
        onActivate={(album) => ui.navigate('album', { albumId: album.id })}
        renderCard={(album) => {
          const fav = lib.favorites.albums.includes(album.id)
          const playingThis = lib.songs.find((s) => s.id === player.songId)?.albumId === album.id
          const play = () => {
            const first = album.songIds[0]
            if (first) player.playSong(first, album.songIds, album.name)
          }
          return (
            <StageCardBody
              artLabel={`Open ${album.name}`}
              art={<img src={album.coverUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
              title={album.name}
              subtitle={`${album.year ? `${album.year} · ` : ''}${album.artist}`}
              sub2={`${album.songIds.length} track${album.songIds.length !== 1 ? 's' : ''}`}
              onActivate={() => ui.navigate('album', { albumId: album.id })}
              badge={
                playingThis && player.isPlaying ? (
                  <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-md">
                    <span className="eq-bars" aria-hidden="true"><i /><i /><i /></span>
                    <span className="track-stencil text-[9px] text-white/85">PLAYING</span>
                  </span>
                ) : undefined
              }
              actions={
                <>
                  <span
                    onClick={play}
                    className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center"
                    role="button"
                    aria-label={`Play ${album.name}`}
                  >
                    <IconPlay size={16} />
                  </span>
                  <button
                    className={cn('icon-btn h-9 w-9', fav && 'active')}
                    style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
                    onClick={(e) => { e.stopPropagation(); lib.toggleFavAlbum(album.id) }}
                    aria-label={fav ? 'Remove album from favorites' : 'Add album to favorites'}
                  >
                    {fav ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
                  </button>
                  <button
                    className="icon-btn h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation()
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      ui.openCtx(r.left - 210, r.bottom + 6, [
                        { label: 'Open Album', action: () => ui.navigate('album', { albumId: album.id }) },
                        { label: 'Play Album', action: play },
                        { sep: true },
                        { label: fav ? 'Remove from Favorites' : 'Add to Favorites', action: () => lib.toggleFavAlbum(album.id) },
                        { sep: true },
                        { label: 'Delete Album', danger: true, action: () => confirmDeleteAlbum(album) },
                      ])
                    }}
                    aria-label={`More options for ${album.name}`}
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
    </div>
  )
}
