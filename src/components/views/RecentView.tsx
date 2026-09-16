import { useMemo } from 'react'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { cn } from '../../lib/format'
import { EmptyState, SectionTitle, GlassButton } from './shared'
import { Stage3D } from '../stage/Stage3D'
import { confirmClearHistory } from '../confirmActions'
import { IconClock, IconMore, IconPlay, IconPause, IconTrash, IconHeart, IconHeartFill } from '../icons'
import { songMenuItems } from '../songMenu'

/** Recently played, on the same 3D stage as the rest of the library. */
export function RecentView() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const ui = useUiStore()

  const entries = useMemo(() => {
    const out: Array<{ songId: string; at: number }> = []
    const seen = new Set<string>()
    for (let i = lib.history.length - 1; i >= 0; i--) {
      const h = lib.history[i]
      if (seen.has(h.songId)) continue
      seen.add(h.songId)
      out.push(h)
      if (out.length >= 200) break
    }
    return out
  }, [lib.history])

  if (!entries.length) {
    return <EmptyState icon={<IconClock size={28} />} title="还没有播放记录。" hint="播放历史会像唱片的纹路一样在这里累积。" />
  }

  const contextIds = entries.map((e) => e.songId)

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionTitle
        title="最近播放"
        hint={`${entries.length} 首在循环中`}
        action={
          <GlassButton onClick={() => confirmClearHistory()}>
            <span className="flex items-center gap-2"><IconTrash size={13} /> 清空</span>
          </GlassButton>
        }
      />
      <Stage3D
        items={entries}
        keyOf={(e) => e.songId}
        label="最近播放舞台"
        thumbnailOf={(e) => lib.getSong(e.songId)?.coverUrl}
        followKey={player.songId}
        onActivate={(e) => {
          const s = lib.getSong(e.songId)
          if (!s) return
          if (player.songId === s.id) player.toggle()
          else player.playSong(s.id, contextIds, '最近播放')
        }}
        renderCard={(e) => {
          const song = lib.getSong(e.songId)
          if (!song) return null
          const album = lib.getAlbum(song.albumId)
          const isCurrent = player.songId === song.id
          const isPlaying = isCurrent && player.isPlaying
          const fav = lib.favorites.songs.includes(song.id)
          const play = () => (isCurrent ? player.toggle() : player.playSong(song.id, contextIds, '最近播放'))
          return (
            <div className="relative">
              <div
                className="relative cursor-pointer overflow-hidden rounded-[16px]"
                style={{ aspectRatio: '1 / 1' }}
                onClick={play}
                role="button"
                aria-label={`${isPlaying ? '暂停' : '播放'} ${song.title}`}
              >
                <img src={song.coverUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                <span className="pointer-events-none absolute inset-0 rounded-[16px]" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)' }} />
                <span className="glass-soft pointer-events-none absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] tabular-nums">
                  {when(e.at)}
                </span>
                {isCurrent && (
                  <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-md">
                    <span className={cn('eq-bars', !isPlaying && 'eq-paused')} aria-hidden="true"><i /><i /><i /></span>
                    <span className="track-stencil text-[9px] text-white/85">{isPlaying ? '播放中' : 'PAUSED'}</span>
                  </span>
                )}
              </div>

              <div className="cursor-pointer px-1.5 pb-0.5 pt-3.5" onClick={play}>
                <div className="truncate text-[16px] font-semibold tracking-tight">{song.title}</div>
                <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>{song.artist} · {album?.name ?? '—'}</div>
              </div>

              <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-2.5">
                <span onClick={play} className="lg-btn lg-btn-primary grid h-10 w-10 cursor-pointer place-items-center" role="button" aria-label={isPlaying ? '暂停' : '播放'}>
                  {isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
                </span>
                <button
                  className={cn('icon-btn h-9 w-9', fav && 'active')}
                  style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
                  onClick={(ev) => { ev.stopPropagation(); lib.toggleFavSong(song.id) }}
                  aria-label={fav ? '取消收藏' : '加入收藏'}
                >
                  {fav ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
                </button>
                <button
                  className="icon-btn h-9 w-9"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
                    ui.openCtx(r.left - 210, r.bottom + 6, songMenuItems(song))
                  }}
                  aria-label={`${song.title} 的更多选项`}
                >
                  <IconMore size={15} />
                </button>
              </div>
            </div>
          )
        }}
      />
      <div className="h-10" />
    </div>
  )
}

function when(ts: number): string {
  const d = Date.now() - ts
  const min = Math.floor(d / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day} 天前`
  return new Date(ts).toLocaleDateString()
}
