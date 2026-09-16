import { motion } from 'framer-motion'
import { useSettingsStore } from '../../stores/settings'
import type { Album, Artist, ViewMode, ViewPage } from '../../types/models'
import { IconDisc, IconList, IconMore, IconPlay } from '../icons'
import { cn } from '../../lib/format'

/**
 * Every browsing surface can be read as the 3D stage or as a plain list, and
 * the choice is remembered per page. Same control everywhere, so switching
 * never feels like a different product.
 */
export function ViewModeToggle({ page }: { page: ViewPage }) {
  const mode = useSettingsStore((s) => s.settings.viewModes[page])
  const setViewMode = useSettingsStore((s) => s.setViewMode)

  return (
    <div className="glass-soft flex rounded-full p-1" role="tablist" aria-label={`${page} view mode`}>
      {([['stage', '3D Stage', IconDisc], ['list', 'List', IconList]] as const).map(([id, label, Icon]) => (
        <button
          key={id}
          role="tab"
          aria-selected={mode === id}
          onClick={() => setViewMode(page, id as ViewMode)}
          className={cn(
            'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-300',
            mode === id ? 'font-medium' : 'hover:text-white',
          )}
          style={{ color: mode === id ? 'var(--c-ink)' : 'var(--c-ink-faint)' }}
        >
          {mode === id && (
            <motion.span
              layoutId={`vm-${page}`}
              className="absolute inset-0 rounded-full bg-white/10"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center gap-1.5"><Icon size={13} />{label}</span>
        </button>
      ))}
    </div>
  )
}

export function useViewMode(page: ViewPage): ViewMode {
  return useSettingsStore((s) => s.settings.viewModes[page])
}

/** One album as a list row. */
export function AlbumRow({ album, index, onOpen, onPlay, onMore }: {
  album: Album
  index: number
  onOpen: () => void
  onPlay: () => void
  onMore: (el: HTMLElement) => void
}) {
  return (
    <div className="song-row group" onContextMenu={(e) => { e.preventDefault(); onMore(e.currentTarget as HTMLElement) }}>
      <span className="track-stencil grid h-12 w-10 place-items-center text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <button className="relative h-12 w-12 shrink-0" onClick={onOpen} aria-label={`Open ${album.name}`} tabIndex={-1}>
        <img src={album.coverUrl} alt="" loading="lazy" className="h-full w-full rounded-lg object-cover shadow-md transition-transform duration-500 group-hover:scale-105" />
        <span className="pointer-events-none absolute inset-0 rounded-lg" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }} />
      </button>
      <button className="flex min-w-0 flex-col items-start text-left" onClick={onOpen}>
        <span className="block w-full truncate text-[14.5px] font-medium">{album.name}</span>
        <span className="block w-full truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>{album.artist}</span>
      </button>
      <div className="flex items-center gap-1 pl-1">
        <span className="hidden text-[12.5px] tabular-nums md:block" style={{ color: 'var(--c-ink-faint)' }}>{album.year ?? ''}</span>
        <span className="hidden w-16 text-right text-[12px] tabular-nums md:block" style={{ color: 'var(--c-ink-faint)' }}>
          {album.songIds.length} track{album.songIds.length !== 1 ? 's' : ''}
        </span>
        <button className="icon-btn h-9 w-9" onClick={onPlay} aria-label={`Play ${album.name}`}><IconPlay size={16} /></button>
        <button
          className="icon-btn h-9 w-9"
          onClick={(e) => onMore(e.currentTarget as HTMLElement)}
          aria-label={`More options for ${album.name}`}
        >
          <IconMore size={16} />
        </button>
      </div>
    </div>
  )
}

/** One artist as a list row. */
export function ArtistRow({ artist, cover, count, top, index, onOpen, onPlay, onMore }: {
  artist: Artist
  cover?: string
  count: number
  top?: string
  index: number
  onOpen: () => void
  onPlay: () => void
  onMore: (el: HTMLElement) => void
}) {
  return (
    <div className="song-row group">
      <span className="track-stencil grid h-12 w-10 place-items-center text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <button className="relative h-12 w-12 shrink-0" onClick={onOpen} aria-label={`Open ${artist.name}`} tabIndex={-1}>
        {cover
          ? <img src={cover} alt="" loading="lazy" className="h-full w-full rounded-full object-cover shadow-md" />
          : <span className="grid h-full w-full place-items-center rounded-full" style={{ background: 'var(--c-tint)' }}>{artist.name[0]}</span>}
      </button>
      <button className="flex min-w-0 flex-col items-start text-left" onClick={onOpen}>
        <span className="block w-full truncate text-[14.5px] font-medium">{artist.name}</span>
        <span className="block w-full truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
          {artist.albumIds.length} album{artist.albumIds.length !== 1 ? 's' : ''}
          {top ? ` · top: ${top}` : ''}
        </span>
      </button>
      <div className="flex items-center gap-1 pl-1">
        <span className="hidden text-[12px] tabular-nums md:block" style={{ color: 'var(--c-ink-faint)' }}>{count} song{count !== 1 ? 's' : ''}</span>
        <button className="icon-btn h-9 w-9" onClick={onPlay} aria-label={`Play ${artist.name}`}><IconPlay size={16} /></button>
        <button
          className="icon-btn h-9 w-9"
          onClick={(e) => onMore(e.currentTarget as HTMLElement)}
          aria-label={`More options for ${artist.name}`}
        >
          <IconMore size={16} />
        </button>
      </div>
    </div>
  )
}
