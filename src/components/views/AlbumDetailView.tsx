import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { useUiStore } from '../../stores/ui'
import { useSettingsStore } from '../../stores/settings'
import { SongRow, EmptyState, GlassButton } from './shared'
import { CoverArt3D } from '../album/CoverArt3D'
import { fmtTime } from '../../lib/format'
import { IconPlay, IconShuffle, IconHeart, IconHeartFill, IconEdit, IconClose } from '../icons'
import { useState } from 'react'
import type { AlbumLayout } from '../../types/models'
import { useAlbumLayout } from '../album/layout'

export function AlbumDetailView() {
  const albumId = useUiStore((s) => s.params.albumId)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const navigate = useUiStore((s) => s.navigate)
  const album = lib.albums.find((a) => a.id === albumId)
  const [customOpen, setCustomOpen] = useState(false)

  const songs = useMemo(
    () => (album ? album.songIds.map((id) => lib.getSong(id)!).filter(Boolean) : []),
    [album, lib],
  )
  if (!album) return <EmptyState title="找不到这张专辑。" hint="它可能已从音乐库中移除。" />
  const duration = songs.reduce((a, s) => a + s.duration, 0)
  const fav = lib.favorites.albums.includes(album.id)
  const isPlayingAlbum = usePlayerStore.getState().songId && songs.some((s) => s.id === usePlayerStore.getState().songId)

  return (
    <div className="mx-auto max-w-[1000px]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-8 md:grid-cols-[280px_minmax(0,1fr)]"
      >
        <div>
          <CoverArt3D albumId={album.id} url={album.coverUrl} name={album.name} size="hero" />
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              className="lg-btn lg-btn-primary flex items-center justify-center gap-2 py-3 text-[13.5px] font-semibold"
              onClick={() => songs[0] && player.playSong(songs[0].id, album.songIds, album.name)}
            >
              <IconPlay size={15} /> 播放专辑
            </button>
            <div className="flex gap-2.5">
              <GlassButton className="flex-1" onClick={() => {
                const ids = album.songIds
                player.playSong(ids[Math.floor(Math.random() * ids.length)], ids, '随机播放')
                if (!player.shuffle) player.toggleShuffle()
              }}>
                <span className="flex items-center justify-center gap-2"><IconShuffle size={14} /> 随机播放</span>
              </GlassButton>
              <button
                className="icon-btn glass-soft h-[42px] w-[42px] rounded-full"
                onClick={() => lib.toggleFavAlbum(album.id)}
                aria-label={fav ? '取消收藏' : '收藏这张专辑'}
                style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
              >
                {fav ? <IconHeartFill size={17} /> : <IconHeart size={17} />}
              </button>
              <button
                className="icon-btn glass-soft h-[42px] w-[42px] rounded-full"
                onClick={() => setCustomOpen((v) => !v)}
                aria-label="自定义专辑布局"
              >
                {customOpen ? <IconClose size={15} /> : <IconEdit size={15} />}
              </button>
            </div>
            {customOpen && <LayoutEditor albumId={album.id} />}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.3em]" style={{ color: 'var(--c-ink-faint)' }}>专辑</div>
          <h1 className="mt-1.5 text-[30px] font-bold leading-tight tracking-tight">{album.name}</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--c-ink-dim)' }}>
            <button className="hover:underline" onClick={() => {
              const artist = lib.artists.find((a) => a.name === album.artist)
              if (artist) navigate('artist', { artistId: artist.id })
            }}>{album.artist}</button>
            {album.year ? ` · ${album.year}` : ''}{album.genre ? ` · ${album.genre}` : ''} · {songs.length} 首 · {fmtTime(duration)}
          </p>
          <div className="song-list mt-6">
            {songs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i + 1} contextIds={album.songIds} />
            ))}
          </div>
        </div>
      </motion.div>
      <div className="h-10" />
    </div>
  )
}

/** Per-album (or global-default) 3D layout editor. */
function LayoutEditor({ albumId }: { albumId: string }) {
  const { layout, isCustom } = useAlbumLayout(albumId)
  const setLayoutAlbum = useSettingsStore((s) => s.setLayoutAlbum)
  const setLayoutGlobal = useSettingsStore((s) => s.setLayoutGlobal)
  const resetLayout = useSettingsStore((s) => s.resetLayout)
  const [scope, setScope] = useState<'album' | 'global'>(isCustom ? 'album' : 'global')

  const set = (patch: Partial<AlbumLayout>) => (scope === 'album' ? setLayoutAlbum(albumId, patch) : setLayoutGlobal(patch))
  const cur = layout

  const rows: Array<{ key: keyof AlbumLayout; label: string; min: number; max: number; step: number; unit?: string }> = [
    { key: 'x', label: 'X', min: -200, max: 200, step: 1, unit: 'px' },
    { key: 'y', label: 'Y', min: -200, max: 200, step: 1, unit: 'px' },
    { key: 'z', label: 'Z', min: -300, max: 300, step: 1, unit: 'px' },
    { key: 'rx', label: 'X 轴旋转', min: -45, max: 45, step: 1, unit: '°' },
    { key: 'ry', label: 'Y 轴旋转', min: -45, max: 45, step: 1, unit: '°' },
    { key: 'rz', label: 'Z 轴旋转', min: -45, max: 45, step: 1, unit: '°' },
    { key: 'scale', label: '缩放', min: 0.5, max: 1.6, step: 0.01 },
    { key: 'shadow', label: '阴影', min: 0, max: 1.5, step: 0.05 },
    { key: 'depth', label: '深度', min: 0, max: 120, step: 1 },
    { key: 'reflection', label: '倒影', min: 0, max: 1, step: 0.05 },
  ]

  return (
    <div className="glass-soft mt-1 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px]">
        <button
          className={`rounded-full px-2.5 py-1 ${scope === 'album' ? 'bg-white/12' : 'opacity-60'}`}
          onClick={() => setScope('album')}
        >这张专辑</button>
        <button
          className={`rounded-full px-2.5 py-1 ${scope === 'global' ? 'bg-white/12' : 'opacity-60'}`}
          onClick={() => setScope('global')}
        >全局默认</button>
        <button className="ml-auto text-[11px] underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-faint)' }} onClick={() => resetLayout(scope === 'album' ? albumId : undefined)}>
          重置
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r) => (
          <label key={r.key} className="block text-[11px]" style={{ color: 'var(--c-ink-dim)' }}>
            <span className="flex justify-between">
              {r.label}
              <span className="tabular-nums">{typeof cur[r.key] === 'number' ? (cur[r.key] as number).toFixed(r.step < 1 ? 2 : 0) : ''}{r.unit ?? ''}</span>
            </span>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={cur[r.key] as number}
              onChange={(e) => set({ [r.key]: parseFloat(e.target.value) } as Partial<AlbumLayout>)}
              className="w-full"
              style={{ ['--fill' as any]: `${((cur[r.key] as number - r.min) / (r.max - r.min)) * 100}%` }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
