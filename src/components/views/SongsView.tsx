import { useMemo, useState } from 'react'
import { useLibraryStore } from '../../stores/library'
import { SongRow, EmptyState, SectionTitle } from './shared'
import { SongCarousel } from './SongCarousel'
import { ViewModeToggle, useViewMode } from './viewMode'
import { IconNote, IconSearch } from '../icons'
import { cn } from '../../lib/format'

const PAGE = 120

/**
 * All songs — the 3D stage by default, the classic focus-row list on request.
 * The choice is remembered, so the page opens the way you left it.
 */
export function SongsView() {
  const songs = useLibraryStore((s) => s.songs)
  const [hover, setHover] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const mode = useViewMode('songs')
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    if (!query.trim()) return songs
    const q = query.toLowerCase()
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
  }, [songs, query])

  const visible = filtered.slice(0, limit)
  const allIds = filtered.map((s) => s.id)

  if (!songs.length) {
    return <EmptyState icon={<IconNote size={30} />} title="还没有歌曲。" hint="添加音乐文件夹后,曲目会汇集到这里。" />
  }

  return (
    <div className={cn(mode === 'stage' ? 'w-full' : 'mx-auto max-w-[980px]')}>
      <SectionTitle
        title="歌曲"
        hint={`${filtered.length} 首`}
        action={
          <div className="flex items-center gap-2">
            <label className="glass-soft flex items-center gap-2 rounded-full px-3.5 py-2">
              <IconSearch size={13} style={{ color: 'var(--c-ink-faint)' }} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
                placeholder="筛选…"
                className="w-[110px] bg-transparent text-[12.5px] outline-none placeholder:text-white/25"
                aria-label="筛选歌曲"
              />
            </label>
            <ViewModeToggle page="songs" />
          </div>
        }
      />

      {mode === 'stage' ? (
        <SongCarousel songs={filtered} contextIds={allIds} />
      ) : (
        <>
          <div className={cn('song-list', hover && 'opacity-100')}>
            {visible.map((song, i) => (
              <SongRow key={song.id} song={song} index={i + 1} contextIds={allIds} dimmed={!!hover && hover !== song.id} onHover={setHover} />
            ))}
          </div>
          {filtered.length > visible.length && (
            <button
              className="glass-soft mt-4 w-full rounded-2xl py-3 text-[12.5px] transition hover:bg-white/8"
              onClick={() => setLimit((l) => l + PAGE)}
            >
              Reveal {Math.min(PAGE, filtered.length - visible.length)} more…
            </button>
          )}
        </>
      )}
      <div className="h-8" />
    </div>
  )
}
