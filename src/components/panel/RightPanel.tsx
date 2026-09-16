import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useUiStore } from '../../stores/ui'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useSettingsStore, DEFAULT_LYRICS } from '../../stores/settings'
import { useIsMobile } from '../../hooks/useMedia'
import { cn } from '../../lib/format'
import { QueuePanel, LyricsPanel, useLyricHighlight } from './QueuePanel'
import { KaraokeLine } from '../lyrics/KaraokeLine'
import { CoverArt3D } from '../album/CoverArt3D'
import { IconHeart, IconHeartFill, IconAlbum, IconExpand, IconNote, IconQueue, IconDisc, IconSettings, IconChevronDown } from '../icons'
import type { LyricsSettings, Song } from '../../types/models'

type Tab = 'now' | 'lyrics' | 'queue'

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('now')
  return (
    <aside className="flex w-[344px] shrink-0 flex-col px-4 pb-32 pt-1" aria-label="Now playing panel">
      <div className="glass-soft mb-6 flex rounded-full p-1" role="tablist" aria-label="Panel tabs">
        {([['now', 'Now', IconDisc], ['lyrics', '歌词', IconNote], ['queue', '播放队列', IconQueue]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-[12.5px] transition-colors duration-300',
              tab === id ? 'font-medium' : 'hover:text-white',
            )}
            style={{ color: tab === id ? 'var(--c-ink)' : 'var(--c-ink-faint)' }}
          >
            {tab === id && (
              <motion.span
                layoutId="rp-tab"
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5"><Icon size={14} />{label}</span>
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'now' && <NowTab />}
        {tab === 'lyrics' && <LyricsPanel />}
        {tab === 'queue' && <QueuePanel />}
      </div>
    </aside>
  )
}

function NowTab() {
  const songId = usePlayerStore((s) => s.songId)
  const lib = useLibraryStore()
  const toggleNowPlaying = useUiStore((s) => s.toggleNowPlaying)
  const navigate = useUiStore((s) => s.navigate)
  const toggleFavAlbum = useLibraryStore((s) => s.toggleFavAlbum)
  const song = songId ? lib.getSong(songId) : undefined
  const album = song ? lib.getAlbum(song.albumId) : undefined
  const favAlbum = album ? lib.favorites.albums.includes(album.id) : false

  if (!song || !album) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="w-full max-w-[240px]">
          {/* a record waiting on the platter */}
          <motion.div
            animate={{ y: [0, -9, 0], rotate: [0, 2.5, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="relative mx-auto aspect-square w-full"
          >
            <span className="vinyl vinyl-slow vinyl-paused absolute inset-0 opacity-90" />
            <span className="absolute inset-[34%] grid place-items-center rounded-full" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>
              <IconDisc size={24} />
            </span>
          </motion.div>
          <p className="mt-6 text-[14px] font-medium">唱机上没有唱片</p>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            在任意专辑上放下唱针,它就会出现在这里 —— 封面、歌词与控件。
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button className="lg-btn lg-btn-primary px-4 py-2.5 text-[13px] font-medium" onClick={() => useUiStore.getState().navigate('albums')}>
              Browse albums
            </button>
            <button className="lg-btn px-4 py-2.5 text-[13px]" onClick={() => useUiStore.getState().navigate('folders')}>
              Add music
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <button onClick={() => toggleNowPlaying(true)} className="group w-full" aria-label="打开全屏播放器">
        <CoverArt3D albumId={album.id} url={album.coverUrl} name={album.name} size="panel" />
      </button>
      <div className="mt-5 w-full text-center">
        <div className="truncate text-[15.5px] font-semibold tracking-tight">{song.title}</div>
        <div className="mt-0.5 truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
          {song.artist} {album.name !== song.title ? `· ${album.name}` : ''}
        </div>
      </div>
      <LyricPreview song={song} />
      <LyricsTuner />
      <div className="mt-4 flex items-center gap-2">
        <button
          className="icon-btn h-10 w-10"
          style={{ color: favAlbum ? 'var(--c-accent-2)' : undefined }}
          onClick={() => toggleFavAlbum(album.id)}
          aria-label={favAlbum ? '取消收藏这张专辑' : '收藏这张专辑'}
        >
          {favAlbum ? <IconHeartFill size={18} /> : <IconHeart size={18} />}
        </button>
        <button className="icon-btn h-10 w-10" onClick={() => navigate('album', { albumId: album.id })} aria-label="前往专辑">
          <IconAlbum size={18} />
        </button>
        <button className="icon-btn h-10 w-10" onClick={() => toggleNowPlaying(true)} aria-label="展开播放器">
          <IconExpand size={18} />
        </button>
      </div>
      <div className="mt-auto hidden" />
    </div>
  )
}

/** Floating two-line lyric quote under the Now tab song info. */
function LyricPreview({ song }: { song: Song }) {
  const lib = useLibraryStore()
  const lyrics = useMemo(() => (song ? lib.getLyrics(song) : []), [song, lib])
  const active = useLyricHighlight(lyrics)
  const cur = active >= 0 ? lyrics[active]?.text ?? '' : ''
  const next = lyrics[active + 1]?.text ?? ''
  return (
    <div className="mt-3.5 h-[54px] w-full select-none px-1 text-center italic" aria-hidden="true">
      <div
        className="lyric-line current truncate text-[14px] leading-[27px]"
        style={{ transitionDuration: '560ms' }}
      >
        {cur ? (
          <KaraokeLine
            text={cur}
            from={lyrics[active]?.time ?? 0}
            to={lyrics[active + 1]?.time ?? (lyrics[active]?.time ?? 0) + 6}
            active
          />
        ) : '· · ·'}
      </div>
      <div
        className="lyric-line near truncate text-[12.5px] leading-[27px]"
        style={{ transitionDuration: '560ms' }}
      >
        {next}
      </div>
    </div>
  )
}

/** Inline lyrics settings — the panel from the reference layout. */
function LyricsTuner() {
  const settings = useSettingsStore()
  const [open, setOpen] = useState(false)
  const L = settings.settings.lyrics
  const set = <K extends keyof LyricsSettings>(key: K, value: LyricsSettings[K]) => settings.setLyric(key, value)

  const row = (label: string, control: React.ReactNode, readout?: string) => (
    <div className="flex items-center gap-3">
      <span className="w-[68px] shrink-0 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>{label}</span>
      <div className="min-w-0 flex-1">{control}</div>
      {readout && <span className="w-[40px] shrink-0 text-right text-[11.5px] tabular-nums" style={{ color: 'var(--c-ink-faint)' }}>{readout}</span>}
    </div>
  )

  const seg = (options: Array<{ v: string; label: string }>, value: string, onPick: (v: string) => void, ariaLabel: string) => (
    <div className="glass-soft flex rounded-full p-0.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.v === value
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            onClick={() => onPick(o.v)}
            className={cn('flex-1 rounded-full py-1.5 text-[11.5px] transition-colors duration-200', on ? 'font-medium' : 'hover:text-white')}
            style={{ background: on ? 'var(--c-tint)' : undefined, color: on ? 'var(--c-ink)' : 'var(--c-ink-faint)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="mt-3.5 w-full">
      <button
        className="glass-soft flex w-full items-center gap-2 rounded-full px-3.5 py-2.5 text-[12.5px]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="歌词设置"
      >
        <IconSettings size={14} />
        <span>歌词设置</span>
        <IconChevronDown size={13} className={cn('ml-auto transition-transform duration-300', open && 'rotate-180')} style={{ color: 'var(--c-ink-faint)' }} />
      </button>

      {open && (
        <div className="glass-soft mt-2 space-y-3.5 rounded-2xl p-3.5">
          {row('字号', (
            <input
              type="range" min={13} max={34} step={1} value={L.size}
              onChange={(e) => set('size', parseInt(e.target.value, 10))}
              style={{ ['--fill' as any]: `${((L.size - 13) / 21) * 100}%` }}
              aria-label="歌词字号"
            />
          ), `${L.size}px`)}

          {row('不透明度', (
            <input
              type="range" min={0.3} max={1} step={0.05} value={L.opacity}
              onChange={(e) => set('opacity', parseFloat(e.target.value))}
              style={{ ['--fill' as any]: `${((L.opacity - 0.3) / 0.7) * 100}%` }}
              aria-label="歌词不透明度"
            />
          ), `${Math.round(L.opacity * 100)}%`)}

          {row('显示行数', seg(
            [1, 2, 3, 4, 5].map((n) => ({ v: String(n), label: String(n) })),
            String(L.lines),
            (v) => set('lines', parseInt(v, 10)),
            '歌词行数',
          ))}

          {row('位置', seg(
            [{ v: 'floating', label: '顶部' }, { v: 'centered', label: '居中' }, { v: 'bottom', label: '底部' }],
            L.mode,
            (v) => set('mode', v as LyricsSettings['mode']),
            '歌词位置',
          ))}

          {row('动画', (
            <button
              role="switch"
              aria-checked={L.animate}
              aria-label="歌词动画"
              onClick={() => set('animate', !L.animate)}
              className="relative h-6 w-11 rounded-full transition-colors duration-300"
              style={{ background: L.animate ? 'var(--c-accent)' : 'rgba(255,255,255,0.14)' }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300"
                style={{ left: L.animate ? 22 : 2 }}
              />
            </button>
          ), L.animate ? '开' : '关')}

          <button
            className="w-full rounded-full py-2 text-[12px] transition hover:bg-white/8"
            style={{ color: 'var(--c-ink-dim)' }}
            onClick={() => (Object.keys(DEFAULT_LYRICS) as Array<keyof LyricsSettings>).forEach((k) => set(k, DEFAULT_LYRICS[k]))}
          >
            重置歌词
          </button>
        </div>
      )}
    </div>
  )
}

export function MobileNowSheet() {
  const mobile = useIsMobile()
  const open = useUiStore((s) => s.nowPlayingOpen)
  if (!mobile || !open) return null
  return null
}

export { useSettingsStore }
