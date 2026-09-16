import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import type { Song } from '../../types/models'
import { IconHeart, IconHeartFill, IconMore, IconPause, IconPlay } from '../icons'
import { cn } from '../../lib/format'
import { songMenuItems } from '../songMenu'
import { Stage3D, StageCardBody } from '../stage/Stage3D'

/**
 * The song stage: the 3D card system with the playing track as its centre.
 */
export function SongCarousel({ songs, contextIds }: { songs: Song[]; contextIds: string[] }) {
  const player = usePlayerStore()
  const lib = useLibraryStore()
  const ui = useUiStore()

  return (
    <Stage3D
      items={songs}
      keyOf={(s) => s.id}
      label="歌曲轮播"
      thumbnailOf={(s) => s.coverUrl}
      followKey={player.songId}
      onActivate={(song) => {
        if (player.songId === song.id) player.toggle()
        else player.playSong(song.id, contextIds, '歌曲')
      }}
      renderCard={(song) => {
        const album = lib.getAlbum(song.albumId)
        const isCurrent = player.songId === song.id
        const isPlaying = isCurrent && player.isPlaying
        const fav = lib.favorites.songs.includes(song.id)
        const play = () => (isCurrent ? player.toggle() : player.playSong(song.id, contextIds, '歌曲'))
        return (
          <StageCardBody
            artLabel={`${isPlaying ? '暂停' : '播放'} ${song.title} by ${song.artist}`}
            art={
              <>
                <img src={song.coverUrl} alt={`${album?.name ?? song.title} 封面`} loading="lazy" draggable={false} className="h-full w-full object-cover" />
                {isCurrent && (
                  <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-md">
                    <span className={cn('eq-bars', !isPlaying && 'eq-paused')} aria-hidden="true"><i /><i /><i /></span>
                    <span className="track-stencil text-[9px] text-white/85">{isPlaying ? '播放中' : 'PAUSED'}</span>
                  </span>
                )}
              </>
            }
            title={song.title}
            subtitle={`${song.artist} · ${album?.name ?? '—'}`}
            onActivate={play}
            actions={
              <>
                <span
                  onClick={play}
                  className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center"
                  role="button"
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
                </span>
                <button
                  className={cn('icon-btn h-9 w-9', fav && 'active')}
                  style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
                  onClick={(e) => { e.stopPropagation(); lib.toggleFavSong(song.id) }}
                  aria-label={fav ? '取消收藏' : '加入收藏'}
                >
                  {fav ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
                </button>
                <button
                  className="icon-btn h-9 w-9"
                  onClick={(e) => {
                    e.stopPropagation()
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    ui.openCtx(r.left - 210, r.bottom + 6, songMenuItems(song))
                  }}
                  aria-label={`${song.title} 的更多选项`}
                >
                  <IconMore size={15} />
                </button>
              </>
            }
          />
        )
      }}
    />
  )
}
