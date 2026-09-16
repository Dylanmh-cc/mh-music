import { useMemo } from 'react'
import type { Album } from '../../types/models'
import { AlbumCard } from '../album/AlbumCard'
import { cn } from '../../lib/format'

/** Group albums by their initial, A→Z with '#' last. */
export function groupByLetter(albums: Album[]): Array<readonly [string, Album[]]> {
  const map = new Map<string, Album[]>()
  for (const a of albums) {
    const key = /[A-Z]/.test(a.letter) ? a.letter : '#'
    const arr = map.get(key) ?? []
    arr.push(a)
    map.set(key, arr)
  }
  return [...map.entries()]
    .sort((x, y) => (x[0] === '#' ? 1 : y[0] === '#' ? -1 : x[0].localeCompare(y[0])))
    .map(([letter, list]) => [letter, list.slice().sort((a, b) => a.name.localeCompare(b.name))] as const)
}

const GRID = 'album-wall card-wall'

/** A dense grid of album sleeves. */
export function AlbumGrid({ albums, className }: { albums: Album[]; className?: string }) {
  return (
    <div className={cn(GRID, className)}>
      {albums.map((album, i) => (
        <AlbumCard key={album.id} album={album} index={i} dimmed={false} onHover={() => {}} />
      ))}
    </div>
  )
}

/** Letter-headed album sections — the A→Z wall from the reference layout. */
export function AlbumSections({ groups }: { groups: Array<readonly [string, Album[]]> }) {
  return (
    <>
      {groups.map(([letter, list]) => (
        <section key={letter} id={`letter-${letter}`} className="mb-10 scroll-mt-4">
          <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-3 px-1 py-1">
            <span className="track-stencil text-[30px] font-bold leading-none" style={{ color: 'var(--c-accent)', textShadow: '0 0 24px var(--c-glow)' }}>
              {letter}
            </span>
            <span className="h-px flex-1" style={{ background: 'linear-gradient(to right, var(--c-glow-soft), transparent)' }} />
            <span className="text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{list.length}</span>
          </div>
          <AlbumGrid albums={list} />
        </section>
      ))}
    </>
  )
}

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

/**
 * The A→Z jump bar from the reference layout. It sits in the flow of the page
 * (a slim glass strip above the wall) rather than floating over the grid, so
 * it can never cover an album. Only letters present in the library are live.
 */
export function LetterIndex({ present }: { present: Set<string> }) {
  const letters = useMemo(() => LETTERS.filter((l) => l !== '#' || present.has('#')), [present])
  const order = useMemo(() => LETTERS.filter((l) => present.has(l)), [present])

  const jump = (letter: string) => {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // every album in the library sits under '#' or A–Z; if none are live there is
  // nothing to navigate, so the bar stays out of the way entirely
  if (!order.length) return null

  return (
    <div className="mb-8 flex justify-center">
      <div
        className="glass-soft flex max-w-full items-center gap-px overflow-x-auto rounded-full px-2.5 py-1.5 no-scrollbar"
        role="navigation"
        aria-label="跳转到字母"
      >
        {letters.map((l) => {
          const live = present.has(l)
          return (
            <button
              key={l}
              disabled={!live}
              onClick={() => jump(l)}
              aria-label={`跳转到 ${l}`}
              className={cn(
                'grid h-6 min-w-[22px] place-items-center rounded-full text-[11px] transition-colors duration-200',
                live ? 'hover:bg-white/12 hover:text-white' : 'cursor-default opacity-25',
              )}
              style={{ color: live ? 'var(--c-ink-dim)' : 'var(--c-ink-faint)' }}
            >
              {l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
