import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { useUiStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { audio, type Levels } from '../audio/engine'
import { useAudioReactive } from '../hooks/useAudioReactive'
import { fmtTime, cn } from '../lib/format'
import { GlassPanel, GlassButton, IconButton } from './glass/GlassPanel'
import { PlayModeButtons } from './player/PlayModeButtons'
import { songMenuItems } from './songMenu'
import {
  IconPlay, IconPause, IconNext, IconPrev, IconHeart, IconHeartFill, IconQueue,
  IconVolume, IconVolumeMute, IconExpand, IconClose, IconMore, IconSearch, IconVinyl,
} from './icons'

/**
 * The floating dock.
 *
 * A glass capsule hovering over the room: the record carries the artwork in
 * its centre, the transport sits on the capsule's axis, and the seek bar is a
 * hairline you can drag anywhere along it. It is deliberately one piece of
 * glass rather than a bar with controls bolted on.
 */
export function PlayerDock({
  onToggleQueue, queueOpen, onOpenSpace, spaceOpen, onCloseSpace, onSearch,
}: {
  onToggleQueue: () => void
  queueOpen: boolean
  onOpenSpace: () => void
  spaceOpen: boolean
  onCloseSpace: () => void
  onSearch: () => void
}) {
  const songId = usePlayerStore((s) => s.songId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const onHome = useUiStore((s) => s.view === 'home')
  // field selectors, not the whole stores: the dock is on screen for the whole
  // session, so a whole-store subscription re-rendered it on every position
  // tick (four a second) and on every unrelated library change
  const prev = usePlayerStore((s) => s.prev)
  const next = usePlayerStore((s) => s.next)
  const song = useLibraryStore((s) => (songId ? s.songs.find((x) => x.id === songId) : undefined))
  const album = useLibraryStore((s) => (song ? s.albums.find((a) => a.id === song.albumId) : undefined))
  const fav = useLibraryStore((s) => (song ? s.favorites.songs.includes(song.id) : false))
  const toggleFavSong = useLibraryStore((s) => s.toggleFavSong)
  const openCtx = useUiStore((s) => s.openCtx)

  return (
    <div className="flex justify-center px-4 pb-4 pt-3">
      <GlassPanel tier="deep" capsule className="relative w-full max-w-[960px] px-4 pb-3 pt-9">
        {/* the seek hairline rides the capsule's top edge */}
        <SeekBar />

        <div className="flex items-center gap-2.5">
          {/* The pair sits centred, but inside a box of fixed width: when the box
              was sized by its own text, a longer artist name widened it and the
              centring slid the sleeve sideways on every track change. Fixed
              width + truncation means the sleeve never moves. */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
            <div className="flex w-[360px] max-w-full items-center gap-2.5">
              <button
                className="group relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl"
                onClick={() => (spaceOpen ? onCloseSpace() : onOpenSpace())}
                aria-label={spaceOpen ? '退出播放空间' : '进入播放空间'}
                title={spaceOpen ? '退出播放空间' : '进入播放空间'}
                style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)' }}
              >
                {song
                  ? <img src={song.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  : <span className="grid h-full w-full place-items-center rounded-xl" style={{ background: 'var(--c-tint)' }}><IconVinyl size={20} /></span>}
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium leading-tight">{song ? song.title : '暂无播放'}</div>
                <div className="mt-0.5 truncate text-[11.5px] leading-tight" style={{ color: 'var(--c-ink-dim)' }}>
                  {song ? `${song.artist}${album ? ` · ${album.name}` : ''}` : '等待你的第一首歌'}
                </div>
              </div>
            </div>
          </div>

          {/* transport */}
          <div className="flex items-center gap-1.5">
            <PlayModeButtons size={32} className="mr-1 hidden lg:flex" />
            <IconButton label="上一首" className="h-10 w-10" onClick={() => prev()}><IconPrev size={19} /></IconButton>
            <PlayButton />
            <IconButton label="下一首" className="h-10 w-10" onClick={() => next()}><IconNext size={19} /></IconButton>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <IconButton
              label={fav ? '取消收藏' : '加入收藏'}
              className="h-10 w-10"
              active={fav}
              disabled={!song}
              onClick={() => song && toggleFavSong(song.id)}
            >
              {fav ? <IconHeartFill size={17} /> : <IconHeart size={17} />}
            </IconButton>
            <Volume />
            {/* On the home route the queue is part of the page itself, so the
                list button would open a second copy of the same thing. */}
            {!onHome && (
              <IconButton
                label={queueOpen ? '隐藏播放队列' : '显示播放队列'}
                className="h-10 w-10"
                active={queueOpen}
                onClick={onToggleQueue}
              >
                <IconQueue size={18} />
              </IconButton>
            )}
            {/* Rendered even with nothing loaded, and just disabled: showing it
                only once a track arrived made the control cluster wider, which
                squeezed the flexible middle and slid the sleeve sideways the
                moment playback began. */}
            <IconButton
              label={song ? `${song.title} 的更多选项` : '更多选项'}
              className="h-10 w-10"
              disabled={!song}
              onClick={(e) => {
                if (!song) return
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                openCtx(r.left - 210, r.top - 8, songMenuItems(song))
              }}
            >
              <IconMore size={17} />
            </IconButton>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}

/** play/pause with a beat-timed breath, as the spec asks for the whole UI */
function PlayButton() {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const toggle = usePlayerStore((s) => s.toggle)
  const ref = useAudioReactive(useMemo(() => (el: HTMLElement, l: Levels) => {
    el.style.transform = `scale(${1 + l.beat * 0.05})`
    el.style.boxShadow = `0 12px 36px var(--c-glow), 0 0 ${18 + l.energy * 34}px var(--c-glow)`
  }, []))
  return (
    <motion.button
      ref={ref as unknown as React.RefObject<HTMLButtonElement>}
      onClick={toggle}
      whileTap={{ scale: 0.94 }}
      className="mh-btn grid h-[50px] w-[50px] !p-0"
      data-variant="accent"
      aria-label={isPlaying ? '暂停' : '播放'}
      title={isPlaying ? '暂停' : '播放'}
    >
      {isPlaying ? <IconPause size={21} /> : <IconPlay size={21} />}
    </motion.button>
  )
}

function Volume() {
  const muted = usePlayerStore((s) => s.muted)
  const volume = useSettingsStore((s) => s.settings.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)
  const eff = muted ? 0 : volume
  return (
    <div className="flex items-center gap-1.5">
      <IconButton label={muted ? '取消静音' : '静音'} className="h-10 w-10" onClick={toggleMute}>
        {muted || volume === 0 ? <IconVolumeMute size={17} /> : <IconVolume size={17} />}
      </IconButton>
      <input
        type="range" min={0} max={1} step={0.01} value={eff}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-[92px]"
        style={{ ['--fill' as any]: `${eff * 100}%` }}
        aria-label="音量"
      />
    </div>
  )
}

/** A draggable seek hairline; it advances from the audio clock, not React. */
function SeekBar() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pct, setPct] = useState(0)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const position = usePlayerStore((s) => s.position)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const d = audio.duration
      if (fillRef.current && d > 0 && !dragging) fillRef.current.style.transform = `scaleX(${audio.currentTime / d})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragging])

  const at = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  const shown = dragging ? pct : duration ? position / duration : 0

  return (
    // The bar lives inside the capsule: it used to sit on the top edge, half
    // outside the glass, which read as a stray line floating over the dock.
    <div className="absolute inset-x-4 top-3">
      <div
        ref={wrapRef}
        className="group relative h-4 cursor-pointer touch-none"
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(position)}
        tabIndex={0}
        onPointerDown={(e) => {
          if (!duration) return
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          setDragging(true)
          setPct(at(e.clientX))
        }}
        onPointerMove={(e) => { if (dragging) setPct(at(e.clientX)) }}
        onPointerUp={(e) => {
          if (!dragging) return
          const p = at(e.clientX)
          setDragging(false)
          seek(p * duration)
        }}
        // A drag can end without a pointerup — the pointer is cancelled by the
        // OS, the window loses focus, or capture is stolen. Without this the bar
        // stayed in "dragging" and stopped following the audio clock.
        onPointerCancel={() => setDragging(false)}
        onLostPointerCapture={() => setDragging(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.stopPropagation(); seek(Math.min(duration, position + 5)) }
          if (e.key === 'ArrowLeft') { e.stopPropagation(); seek(Math.max(0, position - 5)) }
        }}
      >
        <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <span
          ref={fillRef}
          className="absolute inset-x-0 top-1/2 h-[3px] origin-left -translate-y-1/2 rounded-full transition-[height] duration-300 group-hover:h-[5px]"
          style={{ background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-2))', boxShadow: '0 0 14px var(--c-glow)', transform: `scaleX(${shown})` }}
        />
        <span
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ left: `${shown * 100}%`, boxShadow: '0 0 0 4px var(--c-glow-soft), 0 2px 8px rgba(0,0,0,0.5)', opacity: dragging ? 1 : undefined }}
        />
      </div>
      <div className="mh-mono pointer-events-none absolute inset-x-0 top-[17px] flex justify-between text-[10px]" style={{ color: 'var(--c-ink-faint)' }}>
        <span>{fmtTime(position)}</span>
        <span>{fmtTime(duration)}</span>
      </div>
    </div>
  )
}

export { IconExpand, IconClose, GlassButton }
