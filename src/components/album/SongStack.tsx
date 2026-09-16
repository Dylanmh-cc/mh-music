import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { pushPath } from '../../app/router'
import { fmtTime, cn } from '../../lib/format'
import { rgba } from '../../lib/color'
import { IconPlay, IconPause, IconList } from '../icons'
import type { Song } from '../../types/models'

/**
 * The track list, as a stack.
 *
 * The front card is the track that is on: its artwork, its title, what record it
 * came from, and the two things you would want to do with it. Behind it the next
 * tracks fan away down and to the left, dimmer and smaller with each step, so the
 * queue is readable at a glance without a single line of list chrome.
 *
 * Clicking any card in the stack plays that track; the stack then advances.
 */
export function SongStack({ songs, albumName, limit = 3 }: {
  songs: Song[]
  albumName?: string
  limit?: number
}) {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)
  const currentId = player.songId

  const shown = songs.slice(0, limit)
  if (!shown.length) return null

  // the playing track leads the stack; everything else keeps its order
  const ordered = currentId && shown.some((s) => s.id === currentId)
    ? [...shown].sort((a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0))
    : shown

  const front = ordered[0]
  const playing = front.id === currentId && player.isPlaying
  const album = lib.getAlbum(front.albumId) ?? albumName
  const meta = [
    typeof album === 'string' ? album : album?.name,
    fmtTime(front.duration),
    front.playCount ? `播放过 ${front.playCount} 次` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="relative w-full max-w-[330px]" aria-label="曲目列表">
      <div className="relative" style={{ paddingBottom: 62 }}>
        {/* the cards behind: offset down-left, dimmed and stepped back */}
        {ordered.slice(1).map((song, i) => {
          const step = i + 1
          return (
            <motion.button
              key={song.id}
              layout
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1 - step * 0.4, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              onClick={() => player.playSong(song.id, ordered.map((s) => s.id), albumName ?? '正在播放')}
              className="absolute inset-x-0 top-0 overflow-hidden rounded-2xl border text-left"
              style={{
                height: 132,
                // each card steps down and to the left, and narrows as it recedes
                transform: `translate(${step * -15}px, ${step * 31}px) scale(${1 - step * 0.05})`,
                transformOrigin: 'top right',
                zIndex: 10 - step,
                borderColor: 'rgba(255,255,255,0.07)',
                background: 'rgba(12,14,20,0.72)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
              aria-label={`播放 ${song.title}`}
            >
              <span className="flex h-full items-center gap-2.5 px-3">
                <img src={song.coverUrl} alt="" draggable={false} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{song.title}</span>
                  <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--c-ink-dim)' }}>{song.artist}</span>
                </span>
              </span>
            </motion.button>
          )
        })}

        {/* the front card: the track that is on */}
        <motion.div
          layout
          className="relative z-20 overflow-hidden rounded-2xl border"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            background: 'linear-gradient(150deg, rgba(24,26,36,0.94), rgba(10,11,16,0.96))',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${rgba(front.albumId ? (lib.getAlbum(front.albumId)?.palette.primary ?? '#9fd8ff') : '#9fd8ff', 0.18)}`,
          }}
        >
          <div className="flex items-stretch gap-3 p-3.5">
            {/* the artwork, bleeding to the card's edge the way the reference does */}
            <div className="relative -m-3.5 mr-0 w-[104px] shrink-0 overflow-hidden rounded-l-2xl">
              <img src={front.coverUrl} alt="" draggable={false} className="h-full w-full object-cover" style={{ minHeight: 128 }} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>正在播放</span>
              <span className="mt-1 truncate text-[15px] font-semibold leading-tight">{front.title}</span>
              <span className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--c-ink-dim)' }}>{front.artist}</span>
              <span className="mt-1.5 truncate text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{meta}</span>

              <div className="mt-auto flex items-center gap-2 pt-3">
                <button
                  className="lg-btn lg-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                  onClick={() => (front.id === currentId ? player.toggle() : player.playSong(front.id, ordered.map((s) => s.id), '正在播放'))}
                  aria-label={playing ? '暂停' : '播放'}
                >
                  {playing ? <IconPause size={13} /> : <IconPlay size={13} />}
                  {playing ? '暂停' : '播放'}
                </button>
                <button
                  className="lg-btn flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                  onClick={() => { navigate('album', { albumId: front.albumId }); pushPath(`/album/${front.albumId}`) }}
                >
                  专辑详情
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* how many are behind, and a way into the full list */}
        <div className="relative z-20 mt-3 flex items-center gap-2 pl-1">
          <IconList size={14} />
          <button
            className={cn('truncate text-[11.5px]')}
            style={{ color: 'var(--c-ink-dim)' }}
            onClick={() => { navigate('songs'); pushPath('/songs') }}
          >
            这张唱片共 {songs.length} 首 · 查看完整列表
          </button>
        </div>
      </div>
    </div>
  )
}
