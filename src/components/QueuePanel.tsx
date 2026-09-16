import { motion } from 'framer-motion'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { GlassPanel, GlassButton, IconButton } from './glass/GlassPanel'
import { IconClose, IconPlay } from './icons'
import { UpNextHeader, UpNextList } from './UpNextList'

/**
 * The queue, as a floating glass panel that slides in from the right.
 * Now Playing sits at the top, everything still to come below it, and the list
 * is drag-reorderable.
 */
export function QueuePanel({ onClose }: { onClose: () => void }) {
  const songId = usePlayerStore((s) => s.songId)
  const queue = usePlayerStore((s) => s.queue)
  const lib = useLibraryStore()
  const current = songId ? lib.getSong(songId) : undefined

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0, filter: 'blur(10px)' }}
      animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
      exit={{ x: 34, opacity: 0, filter: 'blur(8px)' }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="hidden md:block"
      aria-label="Play queue"
    >
      <GlassPanel tier="deep" className="mh-queue-panel !static !h-full !w-[368px]">
        <header className="flex items-center gap-2 px-5 pb-3 pt-5">
          <h2 className="mh-display text-[15px]">Queue</h2>
          <span className="mh-mono text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{queue.length}</span>
          <IconButton label="Close the queue" className="ml-auto h-9 w-9" onClick={onClose}><IconClose size={17} /></IconButton>
        </header>
        <div className="mh-divider mx-5" />

        <div className="mh-scroll flex min-h-0 flex-1 flex-col px-3 py-3">
          {current ? (
            <>
              <div className="mh-overline px-2 pb-2" style={{ color: 'var(--c-ink-faint)' }}>Now playing</div>
              <div className="mh-glass-soft mb-4 flex items-center gap-3 rounded-2xl p-3">
                <img src={current.coverUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{current.title}</div>
                  <div className="truncate text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>{current.artist}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="px-2 pb-3 text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>Nothing is playing yet.</p>
          )}

          <UpNextHeader />
          <UpNextList className="min-h-0 flex-1 overflow-y-auto pr-1" />
        </div>

        {queue.length > 0 && (
          <footer className="px-4 pb-4">
            <GlassButton className="w-full" onClick={() => usePlayerStore.getState().loadAndPlay(queue[0].songId)}>
              <IconPlay size={14} /> Play the queue
            </GlassButton>
          </footer>
        )}
      </GlassPanel>
    </motion.aside>
  )
}
