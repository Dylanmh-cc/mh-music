import { memo, useState } from 'react'
import type { Song } from '../../types/models'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { fmtTime, cn } from '../../lib/format'
import { IconHeart, IconHeartFill, IconMore, IconPlay, IconPause } from '../icons'
import { songMenuItems } from '../songMenu'

/** One song row — always shows the album artwork, with focus interaction. */
export const SongRow = memo(function SongRow({
  song,
  index,
  contextIds,
  dimmed,
  onHover,
  onRemove,
  extraAction,
}: {
  song: Song
  index?: number
  contextIds: string[]
  dimmed?: boolean
  onHover?: (id: string | null) => void
  onRemove?: () => void
  extraAction?: { label: string; action: () => void }
}) {
  // Narrow selectors on purpose: a whole-store subscription re-renders every
  // row in the list on each position tick (four a second) and on every library
  // edit, which defeats the `memo` above.
  const songId = usePlayerStore((s) => s.songId)
  const playing = usePlayerStore((s) => s.isPlaying)
  const toggle = usePlayerStore((s) => s.toggle)
  const playSong = usePlayerStore((s) => s.playSong)
  const fav = useLibraryStore((s) => s.favorites.songs.includes(song.id))
  const album = useLibraryStore((s) => s.albums.find((a) => a.id === song.albumId))
  const openCtx = useUiStore((s) => s.openCtx)
  const navigate = useUiStore((s) => s.navigate)
  const toggleFavSong = useLibraryStore((s) => s.toggleFavSong)
  const isCurrent = songId === song.id
  const isPlaying = isCurrent && playing

  const items = songMenuItems(song)
  if (extraAction) items.splice(4, 0, { label: extraAction.label, action: extraAction.action })
  if (onRemove) items.push({ sep: true }, { label: '从歌单移除', danger: true, action: onRemove })

  const activate = () => (isCurrent ? toggle() : playSong(song.id, contextIds, '歌曲'))

  return (
    <div
      className={cn('song-row group gap-1', isCurrent && 'playing', dimmed && 'dimmed')}
      onMouseEnter={() => onHover?.(song.id)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={(e) => { e.preventDefault(); openCtx(e.clientX, e.clientY, items) }}
    >
      {/* index / play state */}
      <button
        className="grid h-12 w-10 place-items-center"
        onClick={activate}
        aria-label={isCurrent && isPlaying ? `暂停 ${song.title}` : `播放 ${song.title}`}
      >
        {isCurrent ? (
          <span className="eq-bars" aria-hidden="true"><i /><i /><i /></span>
        ) : (
          <>
            <span className="track-stencil text-[13px] group-hover:hidden" style={{ color: 'var(--c-ink-faint)' }}>
              {String(song.track ?? index ?? 0).padStart(2, '0')}
            </span>
            <span className="hidden group-hover:block"><IconPlay size={16} /></span>
          </>
        )}
      </button>

      {/* artwork — visible at every breakpoint */}
      <button className="relative h-12 w-12 shrink-0" onClick={activate} aria-label={`播放 ${song.title}`} tabIndex={-1}>
        <img
          src={song.coverUrl}
          alt={`${album?.name ?? song.title} 封面`}
          loading="lazy"
          className="h-full w-full rounded-lg object-cover shadow-md transition-transform duration-500 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-0 rounded-lg" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }} />
      </button>

      {/* title + artist */}
      <button className="flex min-w-0 flex-col items-start text-left" onClick={activate}>
        <span className={cn('song-title block w-full truncate text-[14.5px] font-medium')}>{song.title}</span>
        <span className="block w-full truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>{song.artist}</span>
      </button>

      {/* right cluster */}
      <div className="flex items-center gap-1 pl-1">
        <button
          className="hidden max-w-[190px] truncate text-[12.5px] hover:underline md:block"
          style={{ color: 'var(--c-ink-dim)' }}
          onClick={() => song.albumId && navigate('album', { albumId: song.albumId })}
        >
          {album?.name}
        </button>
        <span className="hidden w-12 text-right text-[12px] tabular-nums md:block" style={{ color: 'var(--c-ink-faint)' }}>
          {fmtTime(song.duration)}
        </span>
        <button
          className={cn('icon-btn h-9 w-9', fav && 'active')}
          onClick={() => toggleFavSong(song.id)}
          aria-label={fav ? `取消收藏 ${song.title}` : `收藏 ${song.title}`}
        >
          {fav ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
        </button>
        <button
          className="icon-btn h-9 w-9"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            openCtx(r.left - 210, r.bottom + 6, items)
          }}
          aria-label={`${song.title} 的更多选项`}
        >
          <IconMore size={16} />
        </button>
      </div>
    </div>
  )
})

/** Section heading with optional action. */
export function SectionTitle({ title, action, hint }: { title: string; action?: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 mt-8 flex items-end justify-between first:mt-0">
      <div>
        <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/** Artful empty state — no blank pages. */
export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="floaty glass-soft grid place-items-center rounded-3xl" style={{ color: 'var(--c-ink-dim)', height: 88, width: 88 }}>
        {icon}
      </div>
      <h3 className="mt-6 text-[17px] font-medium">{title}</h3>
      {hint && <p className="mt-2 max-w-[360px] text-[13.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Horizontal scrolling shelf with snap + edge fade. */
export function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className="shelf no-scrollbar"
        style={{
          maskImage: 'linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 24px, #000 calc(100% - 24px), transparent)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Big liquid-glass primary button. */
export function GlassButton({ children, onClick, primary, className, ariaLabel, disabled }: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean; className?: string; ariaLabel?: string; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn('lg-btn px-6 py-3 text-[13.5px] font-medium disabled:cursor-not-allowed disabled:opacity-40', primary && 'lg-btn-primary', className)}
    >
      {children}
    </button>
  )
}
