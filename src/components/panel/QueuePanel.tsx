import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, motion } from 'framer-motion'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useSettingsStore } from '../../stores/settings'
import { audio } from '../../audio/engine'
import { useLyricFollow } from '../../hooks/useLyricFollow'
import { fmtTime, cn } from '../../lib/format'
import { IconTrash, IconPlay, IconMusic } from '../icons'
import { KaraokeLine } from '../lyrics/KaraokeLine'

/** Right-panel queue: drag to reorder, click to jump, remove / clear. */
export function QueuePanel() {
  const songId = usePlayerStore((s) => s.songId)
  const queue = usePlayerStore((s) => s.queue)
  const clearQueue = usePlayerStore((s) => s.clearQueue)
  const loadAndPlay = (usePlayerStore as any).getState().loadAndPlay
  const lib = useLibraryStore()

  const current = songId ? lib.getSong(songId) : undefined

  return (
    <div className="flex h-full flex-col">
      <div className="px-1 pb-3">
        <div className="mb-2 text-[11.5px] uppercase tracking-[0.22em]" style={{ color: 'var(--c-ink-faint)' }}>正在播放</div>
        {current ? (
          <div className="glass-soft flex items-center gap-3 rounded-xl p-3">
            <img src={current.coverUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-medium">{current.title}</div>
              <div className="truncate text-[12px]" style={{ color: 'var(--c-ink-dim)' }}>{current.artist}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl px-2 py-3 text-[13px]" style={{ color: 'var(--c-ink-faint)' }}>暂时没有播放。</div>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[11.5px] uppercase tracking-[0.22em]" style={{ color: 'var(--c-ink-faint)' }}>接下来 · {queue.length}</div>
        {queue.length > 0 && (
          <button className="text-[12px] underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-faint)' }} onClick={clearQueue}>
            清空
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center">
          <div className="max-w-[210px]">
            <IconMusic size={28} />
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
              队列是空的。右键任意歌曲即可设为下一首。
            </p>
          </div>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={queue}
          onReorder={(next) => usePlayerStore.setState({ queue: next })}
          className="scroll-silk -mx-1 flex-1 space-y-1 px-1 pb-2"
        >
          {queue.map((item, i) => {
            const song = lib.getSong(item.songId)
            if (!song) return null
            return (
              <Reorder.Item
                key={item.songId + i}
                value={item}
                className="cursor-grab active:cursor-grabbing"
                whileDrag={{ scale: 1.03, boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}
              >
                <div className="song-row group px-2 py-2">
                  <div className="grid w-8 place-items-center text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>
                    <span className="group-hover:hidden">{i + 1}</span>
                    <IconPlay size={13} className="hidden group-hover:block" />
                  </div>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => loadAndPlay(song.id)}>
                    <img src={song.coverUrl} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px]">{song.title}</span>
                      <span className="block truncate text-[12px]" style={{ color: 'var(--c-ink-dim)' }}>{song.artist}</span>
                    </span>
                  </button>
                  <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--c-ink-faint)' }}>{fmtTime(song.duration)}</span>
                  <button
                    className="icon-btn h-8 w-8 opacity-0 group-hover:opacity-100"
                    onClick={() => usePlayerStore.getState().removeQueueAt(i)}
                    aria-label={`把 ${song.title} 移出队列`}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      )}
    </div>
  )
}

export function useLyricHighlight(lyrics: Array<{ time: number; text: string }>) {
  const [active, setActive] = useState(-1)
  const raf = useRef(0)
  useEffect(() => {
    const tick = () => {
      const t = audio.currentTime + 0.05
      let idx = -1
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= t) idx = i
        else break
      }
      setActive((prev) => (prev !== idx ? idx : prev))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [lyrics])
  return active
}

/** Compact lyrics list for the right panel. */
export function LyricsPanel() {
  const songId = usePlayerStore((s) => s.songId)
  const lib = useLibraryStore()
  const song = songId ? lib.getSong(songId) : undefined
  const lyrics = useMemo(() => (song ? lib.getLyrics(song) : []), [song, lib])
  const active = useLyricHighlight(lyrics)
  const speed = useSettingsStore((s) => s.settings.lyrics.speed)
  const follow = useLyricFollow(active)

  if (!song) {
    return <EmptyLyrics text="播放一首歌,歌词就会在这里流过。" />
  }
  if (!lyrics.length) {
    return <EmptyLyrics text="这首歌没有带时间轴的歌词。" />
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        {...follow.bind}
        className="scroll-silk -mx-2 h-full px-2"
        style={{ maskImage: 'linear-gradient(transparent, #000 12%, #000 86%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 12%, #000 86%, transparent)' }}
        aria-label="歌词 —— 滚动可提前查看"
      >
        <div style={{ paddingTop: '38%', paddingBottom: '40%' }}>
          {lyrics.map((line, i) => {
            const isCurrent = i === active
            const nextLine = lyrics[i + 1]
            return (
              <div
                key={i}
                ref={follow.setLine(i)}
                className={cn('lyric-line py-1.5 text-[15px] leading-snug', isCurrent ? 'current' : i < active ? 'past' : i === active + 1 ? 'near' : '')}
                style={{ transitionDuration: `${620 / speed}ms` }}
              >
                {isCurrent ? (
                  <KaraokeLine text={line.text} from={line.time} to={nextLine ? nextLine.time : line.time + 6} active />
                ) : line.text}
              </div>
            )
          })}
        </div>
      </div>

      {/* only when the listener has scrolled away from the sung line */}
      {!follow.following && (
        <button
          onClick={follow.resume}
          className="glass-soft absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px]"
          style={{ color: 'var(--c-ink-dim)' }}
        >
          跟随歌词
        </button>
      )}
    </div>
  )
}

function EmptyLyrics({ text }: { text: string }) {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div className="max-w-[220px]">
        <motion.div animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 4, repeat: Infinity }}>
          <IconMusic size={26} />
        </motion.div>
        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>{text}</p>
      </div>
    </div>
  )
}
