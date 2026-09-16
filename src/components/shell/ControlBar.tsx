import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import { useSettingsStore } from '../../stores/settings'
import { audio } from '../../audio/engine'
import { fmtTime, cn } from '../../lib/format'
import { useAudioReactive } from '../../hooks/useAudioReactive'
import type { Levels } from '../../audio/engine'
import { IconPlay, IconPause, IconNext, IconPrev, IconVolume, IconVolumeMute, IconQueue, IconHeart, IconHeartFill, IconExpand, IconLyrics, IconMore } from '../icons'
import { PlayModeButtons } from '../player/PlayModeButtons'
import { songMenuItems } from '../songMenu'
import { useCallback } from 'react'

/** Silky progress bar: rAF-driven fill + click/drag seeking. */
export function ProgressBar({ compact = false }: { compact?: boolean }) {
  const fillRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const [dragging, setDragging] = useState(false)
  const [dragPct, setDragPct] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = fillRef.current
      const d = audio.duration
      if (el && d > 0 && !dragging) {
        el.style.width = `${(audio.currentTime / d) * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragging])

  const pctAt = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }

  const pct = dragging ? dragPct : duration ? position / duration : 0

  return (
    <div
      ref={wrapRef}
      className={cn('group relative flex w-full cursor-pointer touch-none items-center', compact ? 'h-4' : 'h-5')}
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
        setDragPct(pctAt(e.clientX))
      }}
      onPointerMove={(e) => { if (dragging) setDragPct(pctAt(e.clientX)) }}
      onPointerUp={(e) => {
        if (!dragging) return
        const p = pctAt(e.clientX)
        setDragging(false)
        seek(p * duration)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.stopPropagation(); seek(Math.min(duration, position + 5)) }
        if (e.key === 'ArrowLeft') { e.stopPropagation(); seek(Math.max(0, position - 5)) }
      }}
    >
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/12 transition-all', compact ? 'h-[3px]' : 'h-[5px] group-hover:h-[7px]')}>
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct * 100}%`,
            background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-2))',
            boxShadow: '0 0 12px var(--c-glow)',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        style={{ left: `${pct * 100}%`, boxShadow: '0 0 0 4px var(--c-glow-soft), 0 2px 8px rgba(0,0,0,0.5)', opacity: dragging ? 1 : undefined }}
      />
    </div>
  )
}

function TimeLabels() {
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  return (
    <div className="flex w-full justify-between text-[10.5px] tabular-nums" style={{ color: 'var(--c-ink-faint)' }}>
      <span>{fmtTime(position)}</span>
      <span>{fmtTime(duration)}</span>
    </div>
  )
}

function PlayButton({ size = 46 }: { size?: number }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const toggle = usePlayerStore((s) => s.toggle)

  // beat-reactive: very subtle scale on bass hits
  const ref = useAudioReactive(useCallback((el: HTMLElement, l: Levels) => {
    el.style.transform = `scale(${1 + l.beat * 0.045})`
  }, []))

  return (
    <motion.button
      ref={ref as any}
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      className="lg-btn lg-btn-primary grid place-items-center"
      style={{ width: size, height: size }}
      aria-label={isPlaying ? '暂停' : '播放'}
    >
      <motion.span
        key={isPlaying ? 'pause' : 'play'}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 24 }}
        className="grid place-items-center"
      >
        {isPlaying ? <IconPause size={size * 0.42} /> : <IconPlay size={size * 0.42} />}
      </motion.span>
    </motion.button>
  )
}

function VolumeControl() {
  const muted = usePlayerStore((s) => s.muted)
  const volume = useSettingsStore((s) => s.settings.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)
  const eff = muted ? 0 : volume

  return (
    <div className="group flex items-center gap-2">
      <button className="icon-btn h-9 w-9" onClick={toggleMute} aria-label={muted ? '取消静音' : '静音'}>
        {muted || volume === 0 ? <IconVolumeMute size={17} /> : <IconVolume size={17} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={eff}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-[100px]"
        style={{ ['--fill' as any]: `${eff * 100}%` }}
        aria-label="音量"
      />
    </div>
  )
}

export function ControlBar() {
  const songId = usePlayerStore((s) => s.songId)
  const player = usePlayerStore()
  const lib = useLibraryStore()
  const ui = useUiStore()
  const song = songId ? lib.getSong(songId) : undefined
  const album = song ? lib.getAlbum(song.albumId) : undefined
  const fav = song ? lib.favorites.songs.includes(song.id) : false
  const rightTab = useUiStore((s) => s.rightTab)

  if (!song) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[78px] z-30 px-3 md:bottom-0 md:px-4 md:pb-4">
        <div className="glass-pill pointer-events-auto mx-auto flex w-full max-w-[520px] items-center gap-3 rounded-[22px] px-5 py-3.5">
          {/* no record-shaped control here: it reads as a button that does
              nothing. One line of intent and one clear action instead. */}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">暂时没有播放</div>
            <div className="truncate text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>挑一张专辑,放下唱针。</div>
          </div>
          <button
            className="lg-btn shrink-0 px-4 py-2 text-[12.5px] font-medium"
            onClick={() => ui.navigate('albums')}
          >
            Browse albums
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-[78px] z-30 px-3 md:bottom-0 md:px-4 md:pb-4">
      <footer
        className="glass-pill group/bar relative mx-auto w-full max-w-[1240px] overflow-hidden rounded-[24px] px-3 py-3 md:px-6 md:py-3.5"
        aria-label="播放控制"
      >
        {/* accent hairline that lights up with the album theme */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-60 transition-opacity duration-500 group-hover/bar:opacity-100"
          style={{ background: 'linear-gradient(90deg, transparent, var(--c-accent-2), transparent)' }}
        />
        <div className="flex items-center gap-3 md:gap-6">
          {/* now playing chip with a spinning micro-record */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl md:h-14 md:w-14"
              onClick={() => ui.toggleNowPlaying(true)}
              aria-label="打开正在播放"
            >
              <img
                src={song.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover shadow-lg transition-transform duration-500 group-hover:scale-105"
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium leading-tight">{song.title}</div>
              <div className="mt-0.5 truncate text-[12.5px] leading-tight" style={{ color: 'var(--c-ink-dim)' }}>
                {song.artist}{album ? ` · ${album.name}` : ''}
              </div>
            </div>
            <button
              className="icon-btn hidden h-10 w-10 shrink-0 sm:flex"
              onClick={() => lib.toggleFavSong(song.id)}
              aria-label={fav ? '取消收藏' : '加入收藏'}
              style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
            >
              {fav ? <IconHeartFill size={17} /> : <IconHeart size={17} />}
            </button>
            <button
              className="icon-btn hidden h-10 w-10 shrink-0 sm:flex"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                ui.openCtx(r.left - 210, r.top - 8, songMenuItems(song))
              }}
              aria-label={`${song.title} 的更多选项`}
            >
              <IconMore size={17} />
            </button>
          </div>

          {/* transport */}
          <div className="flex flex-col items-center gap-1 md:w-[40%] md:max-w-[560px]">
            <div className="flex items-center gap-1.5 md:gap-3">
              <PlayModeButtons size={34} className="mr-0.5 hidden sm:flex" />
              <button className="icon-btn h-11 w-11" onClick={() => player.prev()} aria-label="上一首">
                <IconPrev size={20} />
              </button>
              <PlayButton size={52} />
              <button className="icon-btn h-11 w-11" onClick={() => player.next()} aria-label="下一首">
                <IconNext size={20} />
              </button>
            </div>
            <div className="hidden w-full md:block"><TimeLabels /></div>
            <div className="hidden w-full md:block"><ProgressBar /></div>
          </div>

          {/* right side */}
          <div className="flex flex-1 items-center justify-end gap-1.5">
            <div className="hidden lg:block"><VolumeControl /></div>
            <button
              className={cn('icon-btn h-11 w-11', rightTab === 'queue' && 'active')}
              onClick={() => ui.setRightTab('queue')}
              aria-label="播放队列"
            >
              <IconQueue size={19} />
            </button>
            <button
              className={cn('icon-btn h-11 w-11', rightTab === 'lyrics' && 'active')}
              onClick={() => ui.setRightTab('lyrics')}
              aria-label="歌词"
            >
              <IconLyrics size={19} />
            </button>
            <button className="icon-btn h-11 w-11" onClick={() => ui.toggleNowPlaying(true)} aria-label="全屏播放器">
              <IconExpand size={18} />
            </button>
          </div>
        </div>
        {/* mobile slim progress */}
        <div className="mt-2 md:hidden"><ProgressBar compact /></div>
      </footer>
    </div>
  )
}
