import { Reorder } from 'framer-motion'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { cn, fmtTime } from '../lib/format'
import { IconNote, IconTrash } from './icons'
import { IconButton } from './glass/GlassPanel'

/**
 * "接下来" — the queue as a draggable, numbered list.
 *
 * One implementation, used in two places: the floating queue panel, and the
 * right-hand column of the home page (where the queue belongs to the page
 * rather than to a panel that slides over it).
 */
export function UpNextList({ className }: { className?: string }) {
  const queue = usePlayerStore((s) => s.queue)
  const lib = useLibraryStore()

  if (queue.length === 0) {
    return (
      <div className={cn('grid h-full place-items-center px-3 text-center', className)}>
        <div className="max-w-[210px]">
          <IconNote size={24} />
          <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            队列是空的。右键任意歌曲即可设为下一首。
          </p>
        </div>
      </div>
    )
  }

  return (
    <Reorder.Group
      axis="y"
      values={queue}
      onReorder={(next) => usePlayerStore.setState({ queue: next })}
      className={cn('space-y-1', className)}
    >
      {queue.map((item, i) => {
        const song = lib.getSong(item.songId)
        if (!song) return null
        return (
          <Reorder.Item
            key={item.songId + i}
            value={item}
            className="mh-glass-soft group flex cursor-grab items-center gap-2.5 rounded-xl p-2 active:cursor-grabbing"
            whileDrag={{ scale: 1.02, boxShadow: '0 16px 36px rgba(0,0,0,0.45)' }}
          >
            <span className="mh-mono w-5 shrink-0 text-center text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{i + 1}</span>
            <button
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              onClick={() => usePlayerStore.getState().loadAndPlay(song.id)}
              aria-label={`播放 ${song.title}`}
            >
              <img src={song.coverUrl} alt="" loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px]">{song.title}</span>
                <span className="block truncate text-[11px]" style={{ color: 'var(--c-ink-dim)' }}>{song.artist}</span>
              </span>
            </button>
            <span className="mh-mono text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{fmtTime(song.duration)}</span>
            <IconButton
              label={`把 ${song.title} 移出队列`}
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              onClick={() => usePlayerStore.getState().removeQueueAt(i)}
            >
              <IconTrash size={14} />
            </IconButton>
          </Reorder.Item>
        )
      })}
    </Reorder.Group>
  )
}

/** The small "接下来" heading with its Clear action, shared with the panel. */
export function UpNextHeader() {
  const count = usePlayerStore((s) => s.queue.length)
  return (
    <div className="flex items-center justify-between px-2 pb-2">
      <span className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>接下来</span>
      {count > 0 && (
        <button
          className="text-[11.5px] underline-offset-2 hover:underline"
          style={{ color: 'var(--c-ink-faint)' }}
          onClick={() => usePlayerStore.getState().clearQueue()}
        >
          清空
        </button>
      )}
    </div>
  )
}
