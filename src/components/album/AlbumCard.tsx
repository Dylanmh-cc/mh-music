import { memo, useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Album, CtxItem } from '../../types/models'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'
import { cn } from '../../lib/format'
import { rgba } from '../../lib/color'
import { hashStr } from '../../lib/rand'
import { useTilt } from '../../hooks/useTilt'
import { IconPlay, IconPause, IconHeart, IconHeartFill, IconMore, IconForward } from '../icons'
import { confirmDeleteAlbum } from '../confirmActions'
import { VinylDisc } from './VinylDisc'

const SPRING = { type: 'spring', stiffness: 190, damping: 17, mass: 0.9 } as const

interface Props {
  album: Album
  dimmed: boolean
  onHover: (id: string | null) => void
  index?: number
}

/**
 * A floating album sleeve on the wall. While a track from this album plays,
 * the vinyl slides out and spins on its own; the sleeve keeps a paper inner
 * sleeve, tape and spray marks so it reads as a physical object.
 */
export const AlbumCard = memo(function AlbumCard({ album, dimmed, onHover, index = 0 }: Props) {
  const vinylOutFor = usePlayerStore((s) => s.vinylOutFor)
  const setVinylOut = usePlayerStore((s) => s.setVinylOut)
  const playSong = usePlayerStore((s) => s.playSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentSongId = usePlayerStore((s) => s.songId)
  const currentAlbumId = useLibraryStore((s) => s.songs.find((x) => x.id === currentSongId)?.albumId)
  // selectors rather than whole stores: a grid renders one of these per album,
  // so a whole-store subscription re-rendered the entire wall on every position
  // tick and on any unrelated library change
  const favAlbum = useLibraryStore((s) => s.favorites.albums.includes(album.id))
  const playlists = useLibraryStore((s) => s.playlists)
  const toggleFavAlbum = useLibraryStore((s) => s.toggleFavAlbum)
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist)
  const navigate = useUiStore((s) => s.navigate)
  const openCtx = useUiStore((s) => s.openCtx)
  const animations = useSettingsStore((s) => s.settings.animations)
  const tilt = useTilt(6, 1.02)
  const [imgFail, setImgFail] = useState(false)
  const [manualHide, setManualHide] = useState(false)

  const playingThis = currentAlbumId === album.id && !!currentSongId
  // the record pops out on its own whenever this album is the one playing
  const out = (playingThis && !manualHide) || vinylOutFor === album.id
  const fav = favAlbum
  const delay = useMemo(() => -((hashStr(album.id) % 900) / 100), [album.id])

  const play = useCallback(() => {
    const first = album.songIds[0]
    if (first) {
      setManualHide(false)
      playSong(first, album.songIds, album.name)
    }
  }, [album, playSong])

  const toggleVinyl = useCallback(() => {
    if (playingThis) setManualHide((v) => !v)
    else setVinylOut(out ? null : album.id)
  }, [out, playingThis, album.id, setVinylOut])

  const albumMenu = useCallback((): CtxItem[] => [
    { label: '播放专辑', action: play },
    { label: playingThis && isPlaying ? '暂停' : '继续播放', action: () => usePlayerStore.getState().toggle() },
    { sep: true },
    { label: fav ? '取消收藏' : '加入收藏', action: () => toggleFavAlbum(album.id) },
    { label: '打开专辑', action: () => navigate('album', { albumId: album.id }) },
    {
      label: '添加到歌单',
      submenu: playlists.length
        ? playlists.map((p) => ({ label: p.name, action: () => addToPlaylist(p.id, album.songIds) }))
        : [{ label: '请先创建一个歌单…', action: () => navigate('playlists') }],
    },
    { sep: true },
    { label: '删除专辑', danger: true, action: () => confirmDeleteAlbum(album) },
  ], [album, fav, isPlaying, play, playingThis, playlists, toggleFavAlbum, addToPlaylist, navigate])

  return (
    <div
      className={cn('album-card group relative select-none', dimmed && 'is-dim', animations && 'float-idle')}
      onMouseEnter={() => onHover(album.id)}
      onMouseLeave={() => onHover(null)}
      style={{ ['--float-delay' as any]: `${delay}s`, contentVisibility: 'auto', containIntrinsicSize: 'auto 300px', zIndex: out ? 40 : undefined }}
    >
      {/* album-coloured ambient light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-70"
        style={{ background: `radial-gradient(circle, ${rgba(album.palette.primary, 0.55)} 0%, transparent 70%)` }}
      />

      <div
        className="vinyl-pocket relative cursor-pointer"
        style={{ perspective: '1100px' }}
        onClick={(e) => { e.stopPropagation(); toggleVinyl() }}
        onDoubleClick={(e) => { e.stopPropagation(); play() }}
        onContextMenu={(e) => {
          e.preventDefault()
          openCtx(e.clientX, e.clientY, albumMenu())
        }}
        role="button"
        tabIndex={0}
        aria-label={`${album.name} by ${album.artist}${out ? ' — click to retract vinyl' : ' — click to slide out vinyl'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); toggleVinyl() }
          if (e.key === ' ' && e.target === e.currentTarget) { e.preventDefault(); play() }
        }}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
      >
        {/* the record behind the sleeve — same size as the sleeve, slid out
            ~45% so it reads as a real sleeve with the vinyl half drawn */}
        <motion.div
          className="absolute inset-0 w-full"
          style={{ zIndex: 1 }}
          initial={false}
          animate={{ x: out ? '50%' : '0%', rotate: out ? 0 : -6, scale: out ? 1 : 0.94, opacity: out ? 1 : 0 }}
          transition={SPRING}
        >
          <div
            className="h-full w-full cursor-pointer"
            onClick={(e) => { e.stopPropagation(); playingThis ? setManualHide(true) : setVinylOut(null) }}
            role="button"
            aria-label="收回唱片"
          >
            <VinylDisc spinning={playingThis && isPlaying} speed="normal" labelUrl={album.coverUrl} className="h-full w-full" />
            {/* spray ring that pulses with the record */}
            <div
              className="pointer-events-none absolute inset-[-6%] rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: `radial-gradient(circle, transparent 58%, ${rgba(album.palette.accent, 0.18)} 72%, transparent 80%)` }}
            />
          </div>
        </motion.div>

        {/* sleeve */}
        <motion.div
          className="relative"
          style={{ zIndex: 2 }}
          initial={false}
          animate={{ x: out ? '-5%' : '0%', scale: out ? 1.012 : 1 }}
          transition={SPRING}
        >
          {/* paper inner sleeve, a hairline of card stock peeking from behind */}
          <div
            aria-hidden="true"
            className="absolute inset-y-[1.5%] left-[1.5%] w-[97%] rounded-[6%]"
            style={{ background: 'linear-gradient(120deg, rgba(238,236,230,0.07), rgba(210,206,196,0.035))', transform: 'translateX(4px)' }}
          />
          <motion.div
            className="cover-3d relative overflow-hidden rounded-[6%]"
            style={{
              aspectRatio: '1',
              ...tilt.style,
              boxShadow: `0 20px 52px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.16)`,
            }}
          >
            {imgFail ? (
              <div className="grid h-full w-full place-items-center" style={{ background: `linear-gradient(140deg, ${album.palette.deep2}, ${album.palette.soft})` }}>
                <span className="text-[30px] font-semibold opacity-60">{(album.name[0] ?? '?').toUpperCase()}</span>
              </div>
            ) : (
              <img
                src={album.coverUrl}
                alt=""
                draggable={false}
                loading="lazy"
                onError={() => setImgFail(true)}
                className="h-full w-full object-cover"
              />
            )}
            {/* sleeve sheen — the artwork itself stays edge-to-edge and unclipped */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.13), transparent 30%, transparent 72%, rgba(255,255,255,0.05))' }} />
            {/* stencil track count */}
            <div className="track-stencil pointer-events-none absolute left-3 top-2.5 text-[11px] opacity-75" style={{ color: 'rgba(255,255,255,0.78)', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
              {String(album.songIds.length).padStart(2, '0')}
            </div>

            {/* hover controls */}
            <div className="absolute inset-x-2.5 bottom-2.5 z-10 flex translate-y-3 items-center justify-between opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <button
                className="lg-btn lg-btn-primary grid h-11 w-11 place-items-center rounded-full"
                onClick={(e) => { e.stopPropagation(); if (playingThis && isPlaying) usePlayerStore.getState().toggle(); else play() }}
                aria-label={playingThis && isPlaying ? `暂停 ${album.name}` : `播放 ${album.name}`}
              >
                {playingThis && isPlaying ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>
              <div className="flex gap-1.5">
                <button
                  className="glass-soft grid h-10 w-10 place-items-center rounded-full"
                  onClick={(e) => { e.stopPropagation(); toggleFavAlbum(album.id) }}
                  aria-label={fav ? '取消收藏这张专辑' : '收藏这张专辑'}
                  style={{ color: fav ? 'var(--c-accent-2)' : undefined }}
                >
                  {fav ? <IconHeartFill size={15} /> : <IconHeart size={15} />}
                </button>
                <button
                  className="glass-soft grid h-10 w-10 place-items-center rounded-full"
                  onClick={(e) => { e.stopPropagation(); navigate('album', { albumId: album.id }) }}
                  aria-label={`打开 ${album.name}`}
                >
                  <IconForward size={15} />
                </button>
                <button
                  className="glass-soft grid h-10 w-10 place-items-center rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    openCtx(r.left - 190, r.bottom + 6, albumMenu())
                  }}
                  aria-label={`${album.name} 的更多选项`}
                >
                  <IconMore size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* meta */}
      <button
        className="album-meta mt-3 block w-full text-left"
        onClick={() => navigate('album', { albumId: album.id })}
        aria-label={`打开专辑 ${album.name}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="track-stencil text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{String(index + 1).padStart(2, '0')}</span>
          <span className="truncate text-[14.5px] font-medium leading-tight">{album.name}</span>
        </div>
        <div className="mt-1 truncate text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
          {album.year ? `${album.year} · ` : ''}{album.artist}
        </div>
      </button>
    </div>
  )
})

export function AlbumCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-square w-full rounded-[6%]" />
      <div className="skeleton mt-3 h-3.5 w-3/4 rounded-full" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
    </div>
  )
}
