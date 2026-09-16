import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useUiStore } from '../../stores/ui'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useSettingsStore } from '../../stores/settings'
import { useTilt } from '../../hooks/useTilt'
import { useAudioReactive } from '../../hooks/useAudioReactive'
import { useLyricFollow } from '../../hooks/useLyricFollow'
import { isSynced } from '../../lib/lrc'
import { rgba } from '../../lib/color'
import { cn } from '../../lib/format'
import { audio, type Levels } from '../../audio/engine'
import type { Palette, BgMode } from '../../types/models'
import { ProgressBar } from '../shell/ControlBar'
import {
  IconClose, IconPlay, IconPause, IconNext, IconPrev, IconHeart, IconHeartFill,
  IconQueue, IconList, IconVolume, IconVolumeMute, IconDisc, IconSparkle,
  IconChevronDown, IconCheck,
} from '../icons'
import { useLyricHighlight } from '../panel/QueuePanel'
import { VinylDisc } from '../album/VinylDisc'
import { KaraokeLine } from '../lyrics/KaraokeLine'
import { PlayModeButtons } from './PlayModeButtons'
import { Visualizer } from './Visualizer'

export function NowPlaying() {
  const open = useUiStore((s) => s.nowPlayingOpen)
  const toggleNowPlaying = useUiStore((s) => s.toggleNowPlaying)
  const setRightTab = useUiStore((s) => s.setRightTab)
  const songId = usePlayerStore((s) => s.songId)
  const lib = useLibraryStore()
  const song = songId ? lib.getSong(songId) : undefined
  const album = song ? lib.getAlbum(song.albumId) : undefined
  const bgMode = useSettingsStore((s) => s.settings.bgMode)
  const visualizerMode = useSettingsStore((s) => s.settings.visualizerMode)
  const bgOpacity = useSettingsStore((s) => s.settings.visual.bgOpacity)
  // the landscape is the visualisation now, so it owns the artwork anchor
  const artRef = useRef<HTMLDivElement | null>(null)
  const lyricRef = useRef<HTMLDivElement | null>(null)
  // far planes drift against the pointer, which is what makes the depth read
  const { x: farPx, y: farPy } = useSpaceParallax()
  const farX = useTransform(farPx, (v) => v * 15)
  const farY = useTransform(farPy, (v) => v * 11)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && useUiStore.getState().nowPlayingOpen) toggleNowPlaying(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleNowPlaying])

  return (
    <AnimatePresence>
      {open && song && album && (
        <motion.div
          key="np"
          className="fixed inset-0 z-[180] overflow-hidden"
          style={{ perspective: '1600px' }}
          // no full-screen blur/scale on the way in: animating a filter across
          // a layer this large (two canvases + 3D planes) flashes, so the room
          // simply fades while the content lifts into place
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label="正在播放"
        >
          {/* ── depth stack ────────────────────────────────────────────────
              Room on the far plane, the music landscape floating in front of
              it, then the artwork / vinyl / lyrics / controls (see the
              translateZ values in NpArtwork and NpInfo) and finally the
              corner card. The counter-scales keep the far planes full-bleed
              once perspective has shrunk them. */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ x: farX, y: farY, z: -520, scale: 1.36, opacity: bgOpacity }}
          >
            <NpBackground palette={album.palette} mode={bgMode} />
          </motion.div>

          {/* The visualiser is a flat, full-bleed layer rather than a scaled 3D
              plane: its pixels stay crisp, and the parallax comes from inside
              the renderer instead of from a transform that would resample the
              canvas. Which of the eight modes draws here is a setting. */}
          <div className="pointer-events-none absolute inset-0">
            <Visualizer mode={visualizerMode} palette={album.palette} className="absolute inset-0 h-full w-full" />
          </div>

          <NowPlayingCard song={song.title} artist={song.artist} album={album.name} cover={album.coverUrl} />

          <button className="icon-btn absolute right-5 top-5 z-40 h-11 w-11" onClick={() => toggleNowPlaying(false)} aria-label="关闭全屏播放器">
            <IconClose size={19} />
          </button>

          <div className="np-scene relative z-20 h-full overflow-y-auto scroll-silk">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto grid min-h-full w-full max-w-[1560px] place-items-center gap-10 px-8 py-14 md:grid-cols-[0.92fr_1.18fr] md:px-10"
            >
              <NpArtwork cover={album.coverUrl} name={album.name} palette={album.palette} anchorRef={artRef} />
              <NpInfo
                songTitle={song.title}
                artist={song.artist}
                albumName={album.name}
                albumId={album.id}
                lyricRef={lyricRef}
                onOpenQueue={() => { toggleNowPlaying(false); setRightTab('queue') }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* /player with nothing loaded is a real state: the space is open and
          empty, and it says so instead of leaving the previous page showing */}
      {open && (!song || !album) && (
        <motion.div
          key="np-empty"
          className="fixed inset-0 z-[180] grid place-items-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'radial-gradient(120% 100% at 50% 0%, var(--c-deep-1), var(--c-deep-0) 70%)' }}
          role="dialog"
          aria-label="暂无播放"
        >
          <button className="icon-btn absolute right-5 top-5 h-11 w-11" onClick={() => toggleNowPlaying(false)} aria-label="关闭全屏播放器">
            <IconClose size={19} />
          </button>
          <div className="max-w-[420px] text-center">
            <span className="vinyl vinyl-slow vinyl-paused mx-auto block aspect-square w-[190px]" />
            <h2 className="mh-display mt-7 text-[22px]">唱盘上还没有唱片。</h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
              挑一张唱片,这个空间就会被它填满 —— 封面、歌词,以及它们背后的可视化效果。
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <button className="lg-btn lg-btn-primary px-4 py-2 text-[12.5px]" onClick={() => { toggleNowPlaying(false); useUiStore.getState().navigate('albums') }}>
                浏览专辑
              </button>
              <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => { toggleNowPlaying(false); useUiStore.getState().navigate('folders') }}>
                添加音乐
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/*  Pointer parallax that drives the whole space                       */
/* ------------------------------------------------------------------ */

function useSpaceParallax() {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const x = useSpring(rx, { stiffness: 55, damping: 18, mass: 0.7 })
  const y = useSpring(ry, { stiffness: 55, damping: 18, mass: 0.7 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      rx.set((e.clientX / window.innerWidth - 0.5) * 2)
      ry.set((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [rx, ry])
  return { x, y }
}

/* ------------------------------------------------------------------ */
/*  Background - one 3D space, many particle effects                   */
/* ------------------------------------------------------------------ */

/**
 * The player always plays inside the same 3D room: album-lit nebula, a
 * drifting starfield that parallaxes with the pointer, and the glass-lit
 * horizon. The chosen particle effect is layered on top of it.
 */
/**
 * The room. `mode` picks which treatment fills it, but every one of them is
 * built from the album's palette, so switching records still changes the air.
 */
function NpBackground({ palette, mode }: { palette: Palette; mode: BgMode }) {
  // ── Standard: a dark room, lit only by the landscape ───────────────────
  if (mode === 'deep') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 50% 20%, ${palette.deep2}, ${palette.deep} 72%)` }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(78% 78% at 50% 46%, transparent 42%, rgba(0,0,0,0.5) 100%)' }} />
        <div className="grain" />
      </div>
    )
  }

  // ── Gradient: nothing but the album's own colour, wide and slow ────────
  if (mode === 'gradient') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              `linear-gradient(168deg, ${palette.deep} 0%, ${palette.deep2} 34%, ${rgba(palette.primary, 0.5)} 74%, ${rgba(palette.accent, 0.42)} 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 50% at 50% 104%, ${rgba(palette.accent, 0.34)}, transparent 70%)` }}
        />
        <div className="grain" />
      </div>
    )
  }

  // ── Glass: the room seen through a pane ────────────────────────────────
  if (mode === 'glass') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 62% -8%, ${palette.deep2}, ${palette.deep} 68%)` }} />
        <div
          className="pointer-events-none absolute left-1/2 top-[46%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${rgba(palette.primary, 0.3)}, transparent 70%)`, filter: 'blur(70px)' }}
        />
        {/* two skewed highlights read as refraction across the pane */}
        <div
          className="pointer-events-none absolute -inset-x-1/4 -top-1/4 h-[150%] opacity-40"
          style={{
            background: `linear-gradient(112deg, transparent 34%, ${rgba(palette.accent, 0.22)} 46%, transparent 58%)`,
            filter: 'blur(26px)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 glass-pane" />
        <div className="grain" />
      </div>
    )
  }

  // ── Starry Sky ─────────────────────────────────────────────────────────
  if (mode === 'starry') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <SpaceStage palette={palette} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 0%, ${rgba(palette.primary, 0.16)}, transparent 70%)` }} />
        <div className="grain" />
      </div>
    )
  }

  // ── Sunset: a warm band under the same stars ───────────────────────────
  if (mode === 'sunset') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <SpaceStage palette={palette} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%]"
          style={{
            background:
              `linear-gradient(to top, ${rgba(palette.primary, 0.55)} 0%, ${rgba(palette.accent, 0.34)} 38%, transparent 100%)`,
            filter: 'blur(28px)',
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 bottom-[26%] h-[26vmin] w-[26vmin] -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${rgba(palette.accent, 0.55)}, transparent 70%)`, filter: 'blur(30px)' }}
        />
        <div className="grain" />
      </div>
    )
  }

  // ── Vinyl Room: the inside of a record ─────────────────────────────────
  if (mode === 'vinyl') {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(100% 100% at 50% 50%, ${palette.deep2}, ${palette.deep} 70%)` }} />
        {/* the grooves, as concentric rings that read as the room's walls */}
        <div className="vinyl-room pointer-events-none absolute left-1/2 top-1/2 h-[150vmin] w-[150vmin] -translate-x-1/2 -translate-y-1/2" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[40vmin] w-[40vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${rgba(palette.accent, 0.36)}, transparent 72%)`, filter: 'blur(40px)' }}
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(76% 76% at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)' }} />
        <div className="grain" />
      </div>
    )
  }

  // ── 3D Space and Dynamic share the full room; Dynamic simply lets the
  //    album's own light — and the track's energy — take it over ─────────
  const reactive = mode === 'dynamic'
  return (
    <div className="absolute inset-0 overflow-hidden">
      <SpaceStage palette={palette} />

      <div
        className="pointer-events-none absolute left-1/2 top-[44%] h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${rgba(palette.primary, reactive ? 0.44 : 0.28)}, transparent 68%)`, filter: 'blur(80px)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(80% 60% at 24% 78%, ${rgba(palette.primary, reactive ? 0.34 : 0.22)}, transparent 68%),` +
            `radial-gradient(70% 55% at 78% 22%, ${rgba(palette.accent, reactive ? 0.26 : 0.16)}, transparent 66%)`,
          filter: 'blur(60px)',
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(78% 78% at 50% 46%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
      <div className="grain" />
    </div>
  )
}

/** Space: nebula plus a drifting starfield with its own pointer parallax. */
function SpaceStage({ palette }: { palette: Palette }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    let raf = 0
    let w = window.innerWidth, h = window.innerHeight
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    interface Star { x: number; y: number; z: number; tw: number }
    const stars: Star[] = Array.from({ length: 280 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.pow(Math.random(), 0.6),
      tw: Math.random() * Math.PI * 2,
    }))
    let mx = 0.5, my = 0.5
    const onMove = (e: MouseEvent) => { mx = e.clientX / w; my = e.clientY / h }
    window.addEventListener('mousemove', onMove)
    let last = performance.now()

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      ctx.clearRect(0, 0, w, h)
      const px = (mx - 0.5) * 60, py = (my - 0.5) * 40
      const neb = (nx: number, ny: number, r: number, c: string) => {
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r)
        grad.addColorStop(0, c)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(nx - r, ny - r, r * 2, r * 2)
      }
      neb(w * 0.2 - px, h * 0.3 - py, 430, rgba(palette.primary, 0.17))
      neb(w * 0.85 - px * 1.6, h * 0.74 - py * 1.6, 520, rgba(palette.accent, 0.13))
      neb(w * 0.5 + px * 2, h * 0.08 + py * 2, 320, rgba(palette.accent, 0.09))

      for (const s of stars) {
        s.tw += dt * (0.6 + s.z)
        // a slow drift through the volume gives the field a real Z axis
        s.x -= dt * 6 * s.z
        if (s.x < -6) { s.x = w + 6; s.y = Math.random() * h }
        const x = s.x - px * 34 * s.z
        const y = s.y - py * 24 * s.z + Math.sin(s.tw * 0.5) * 3 * s.z
        const a = (0.2 + Math.abs(Math.sin(s.tw)) * 0.7) * (0.3 + s.z * 0.9)
        ctx.globalAlpha = Math.min(1, a)
        ctx.fillStyle = s.z > 0.75 ? palette.accent : '#dfe9ff'
        const size = s.z > 0.88 ? 2.2 : s.z * 1.7
        ctx.fillRect(x, y, size, size)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', resize) }
  }, [palette])

  return (
    <div className="absolute inset-0" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${palette.deep2}, ${palette.deep} 70%)` }}>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Artwork side - the 3D scene                                        */
/* ------------------------------------------------------------------ */

/**
 * Sleeve plus record, aligned on one axis and one perspective. The record is
 * the same size as the sleeve and slides out about 45%. While the track plays
 * the sleeve breathes with the bass (1.000 to 1.015), the record keeps its own
 * rotation, and both shift on separate Z layers as the pointer moves.
 */
function NpArtwork({ cover, name, palette, anchorRef }: {
  cover: string; name: string; palette: Palette; anchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const tilt = useTilt(9, 1.025)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const vinylSize = useSettingsStore((s) => s.settings.visual.vinylSize)
  const [retracted, setRetracted] = useState(false)
  const out = !retracted
  const { x: pxc, y: pyc } = useSpaceParallax()

  // sleeve and record scale together, so the pair always reads as one object
  const sleeveSize = `calc(min(400px, 30vw) * ${vinylSize})`

  // the sleeve sits nearest the viewer; the record is pushed back behind it
  const sceneX = useTransform(pxc, (v) => v * -30)
  const sceneY = useTransform(pyc, (v) => v * -22)
  const rotY = useTransform(pxc, (v) => v * 9)
  const rotX = useTransform(pyc, (v) => v * -7)

  // the artifact answers the music: bass swells it, mid tilts and nudges it
  const onFrame = useMemo(() => (el: HTMLElement, l: Levels) => {
    el.style.setProperty('--np-breathe', String(1 + l.bass * 0.016))
    el.style.setProperty('--np-glow', String(0.18 + l.energy * 0.5))
    // `translate`/`rotate` are their own CSS properties, so they compose with
    // the transform Framer owns instead of fighting it
    el.style.translate = `${((l.bass - 0.3) * 6).toFixed(2)}px ${((l.mid - 0.3) * -5).toFixed(2)}px`
    el.style.rotate = `${((l.mid - 0.3) * 1.5).toFixed(3)}deg`
  }, [])
  const breathRef = useAudioReactive(onFrame)

  return (
    <div
      ref={anchorRef as React.RefObject<HTMLDivElement>}
      className="relative mx-auto w-full"
      style={{
        ['--sleeve' as any]: sleeveSize,
        maxWidth: 'var(--sleeve)',
        // reserve the space the record occupies so sleeve + record read as centred
        marginRight: 'calc(var(--sleeve) * 0.45)',
        perspective: '1700px',
        perspectiveOrigin: '50% 46%',
        // the album sits on the main plane; the room and the visualisation are
        // behind it, the lyrics and controls in front
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div className="np-layer" style={{ x: sceneX, y: sceneY, rotateX: rotX, rotateY: rotY }}>
        <motion.div
          ref={breathRef as React.RefObject<HTMLDivElement>}
          className="np-layer"
          style={{ ['--np-breathe' as any]: 1, ['--np-glow' as any]: 0.2 }}
          animate={{ y: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div {...tilt} className="relative" style={{ transformStyle: 'preserve-3d' }}>
            {/* the record: same size as the sleeve, a shallow step behind it */}
            <motion.div
              className="absolute inset-0"
              style={{ zIndex: 1 }}
              initial={false}
              animate={{ x: out ? '45%' : '0%', scale: out ? 1 : 0.96, z: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 20, mass: 0.9 }}
            >
              <div
                className="h-full w-full cursor-pointer"
                onClick={() => setRetracted(true)}
                role="button"
                tabIndex={-1}
                aria-label="收回唱片"
              >
                <VinylDisc spinning={isPlaying} labelUrl={cover} className="h-full w-full" />
                {/* the printed screen over the record, so the disc reads as part
                    of the artwork rather than a photo pasted on top of it */}
                <span aria-hidden="true" className="mh-halftone rounded-full" />
                <span aria-hidden="true" className="mh-halftone mh-halftone-coarse rounded-full" />
              </div>
            </motion.div>

            {/* sleeve */}
            <motion.div
              className="relative cursor-pointer"
              style={{ zIndex: 2, transformStyle: 'preserve-3d' }}
              initial={false}
              animate={{ x: out ? '-5%' : '0%', scale: 'var(--np-breathe)', z: 22 } as any}
              transition={{ type: 'spring', stiffness: 160, damping: 20, mass: 0.9 }}
              onClick={() => setRetracted((v) => !v)}
              role="button"
              aria-label={out ? '收回唱片' : '推出唱片'}
            >
              {/* album-coloured bloom that follows the music */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[8%] rounded-[10%]"
                style={{
                  background: `radial-gradient(circle, ${rgba(palette.primary, 0.5)}, transparent 68%)`,
                  filter: 'blur(46px)',
                  opacity: 'var(--np-glow)',
                  transform: 'translateZ(-90px)',
                }}
              />
              <img
                src={cover}
                alt={`${name} 封面`}
                draggable={false}
                className="w-full select-none rounded-2xl object-cover"
                style={{
                  aspectRatio: '1',
                  boxShadow: `0 60px 130px rgba(0,0,0,0.7), 0 22px 54px rgba(0,0,0,0.55), 0 0 110px ${rgba(palette.primary, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.18)`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.16), transparent 34%, transparent 72%, rgba(255,255,255,0.06))' }} />
              <span aria-hidden="true" className="mh-halftone rounded-2xl" style={{ opacity: 0.3 }} />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Info side - lyrics and transport                                   */
/* ------------------------------------------------------------------ */

/**
 * The corner card from the reference: what is playing, at a glance, without
 * competing with the lyrics. It fades back when the pointer is still so the
 * landscape stays the subject.
 */
function NowPlayingCard({ song, artist, album, cover }: { song: string; artist: string; album: string; cover: string }) {
  const [awake, setAwake] = useState(true)
  const timer = useRef(0)

  useEffect(() => {
    const wake = () => {
      setAwake(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setAwake(false), 5200)
    }
    wake()
    window.addEventListener('pointermove', wake, { passive: true })
    window.addEventListener('pointerdown', wake, { passive: true })
    return () => {
      window.clearTimeout(timer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
    }
  }, [])

  return (
    <div
      className="np-glass-panel fixed z-30 hidden items-center gap-3 rounded-2xl px-3 py-2.5 transition-opacity duration-700 md:flex"
      style={{ right: 84, top: 18, opacity: awake ? 1 : 0.45, maxWidth: 300 }}
      role="status"
      aria-live="off"
    >
      <img src={cover} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl object-cover" draggable={false} />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold leading-tight">{song}</div>
        <div className="truncate text-[11.5px] leading-tight" style={{ color: 'var(--c-ink-dim)' }}>{artist}</div>
        <div className="truncate text-[10.5px] leading-tight" style={{ color: 'var(--c-ink-faint)' }}>{album}</div>
      </div>
    </div>
  )
}

/**
 * BASS / MID / TREBLE / ENERGY straight off the shared analyser. Written to
 * the DOM imperatively from the frame loop: four meters running at 60fps must
 * not re-render the lyric tree.
 */
function Meters() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const bars = ref.current?.querySelectorAll<HTMLElement>('[data-meter]')
    if (!bars || !bars.length) return
    const pick = [(l: Levels) => l.bass, (l: Levels) => l.mid, (l: Levels) => l.treble, (l: Levels) => l.energy]
    return audio.onFrame((l) => {
      for (let i = 0; i < pick.length; i++) {
        const el = bars[i]
        if (!el) continue
        const v = Math.max(0, Math.min(1, pick[i](l)))
        el.style.transform = 'scaleX(' + (0.04 + v * 0.96).toFixed(3) + ')'
        el.style.opacity = String(0.5 + v * 0.5)
      }
    })
  }, [])

  return (
    <div ref={ref} className="mt-5 flex items-end justify-center gap-5" aria-hidden="true">
      {['低音', '中音', '高音', '能量'].map((label) => (
        <div key={label} className="flex w-[70px] flex-col items-center gap-2">
          <span className="h-[4px] w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <span
              data-meter=""
              className="block h-full w-full origin-left rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-2))', transform: 'scaleX(0.04)' }}
            />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--c-ink-faint)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
function NpInfo({ songTitle, artist, albumName, albumId, lyricRef, onOpenQueue }: {
  songTitle: string; artist: string; albumName: string; albumId: string
  lyricRef?: React.RefObject<HTMLDivElement | null>
  onOpenQueue: () => void
}) {
  const player = usePlayerStore()
  const lib = useLibraryStore()
  const settings = useSettingsStore()
  const song = lib.getSong(usePlayerStore((s) => s.songId)!)
  const fav = song ? lib.favorites.songs.includes(song.id) : false
  const lyrics = useMemo(() => (song ? lib.getLyrics(song) : []), [song, lib])
  const rawActive = useLyricHighlight(lyrics)
  const synced = isSynced(lyrics)
  // An unsynced lyric has every line pinned to time 0, which would make the
  // "last line <= current time" rule settle on the LAST line — so the view
  // opened at the bottom and never moved. Only follow/highlight when the
  // lyric actually carries a timeline.
  const active = synced ? rawActive : -1
  const L = settings.settings.lyrics
  const { x: pxc, y: pyc } = useSpaceParallax()
  const layerX = useTransform(pxc, (v) => v * -15)
  const layerY = useTransform(pyc, (v) => v * -11)
  const follow = useLyricFollow(active)
  // one line's worth of vertical space, so the window shows exactly `lines`
  const lineHeight = Math.round(L.size * 2.3) * 1.34 + L.gap

  const visible = useMemo(() => {
    if (active < 0) return lyrics.slice(0, L.lines)
    const half = Math.floor(L.lines / 2)
    const start = Math.max(0, Math.min(active - half, lyrics.length - L.lines))
    return lyrics.slice(start, start + L.lines)
  }, [lyrics, active, L.lines])

  return (
    <motion.div
      className="np-layer relative flex min-h-[60vh] flex-col"
      style={{
        x: layerX,
        y: layerY,
        textAlign: L.align === 'left' ? 'left' : L.align === 'right' ? 'right' : 'center',
        alignItems: L.align === 'left' ? 'flex-start' : L.align === 'right' ? 'flex-end' : 'center',
      }}
    >
      {/* a soft scrim keeps type readable over the particle field */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-16%] inset-y-[-8%] rounded-[40px]"
        // the landscape's bright blocks rise right behind the words, so the
        // scrim is doing real work here: darkest under the sung line, gone by
        // the frame's edge so the terrain keeps its shape. It sits at its own
        // Z (not a negative one) so it lands *in front of* the terrain canvas,
        // which is a flat sibling on the z=0 plane.
        style={{
          background: 'radial-gradient(58% 54% at 50% 50%, rgba(4,5,9,0.78), rgba(4,5,9,0.5) 58%, rgba(4,5,9,0.12) 84%, transparent 100%)',
          filter: 'blur(26px)',
          transform: 'translateZ(20px)',
        }}
      />

      <div className="w-full" style={{ transform: 'translateZ(50px)' }}>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]" style={{ textAlign: 'inherit' }}>{songTitle}</h1>
        <p className="mt-1.5 text-[15px]" style={{ color: 'var(--c-ink-dim)' }}>{artist} · {albumName}</p>
      </div>

      {/* floating lyrics: a flowing window that follows the sung line, and can
          be scrolled by hand at any time */}
      <div
        ref={lyricRef as React.RefObject<HTMLDivElement>}
        className="relative my-auto w-full"
        style={{
          transform: 'translateZ(90px)',
          maxWidth: L.side === 'center' ? undefined : '76%',
          alignSelf: L.side === 'left' ? 'flex-start' : L.side === 'right' ? 'flex-end' : 'center',
        }}
      >
        <div
          {...follow.bind}
          className="scroll-silk flex flex-col"
          style={{
            justifyContent: L.mode === 'centered' ? 'center' : L.mode === 'bottom' ? 'flex-end' : 'flex-start',
            maxHeight: Math.round(lineHeight * L.lines),
            gap: L.gap,
            paddingTop: Math.round(lineHeight * 0.6),
            paddingBottom: Math.round(lineHeight * 0.6),
            maskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)',
            WebkitMaskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)',
            ['--lyr-hl' as any]: L.highlight,
            ['--lyr-op' as any]: L.opacity,
          }}
          aria-label="歌词 —— 滚动可提前查看"
        >
          {lyrics.length ? lyrics.map((line, i) => {
            // An unsynced lyric — prose pasted in, or a tag with no clock — has
            // no line to be "on": highlighting one would be a lie, so every line
            // simply reads as text at the same weight.
            const isCurrent = synced && i === active
            const nextLine = lyrics[i + 1]
            return (
              <div
                key={i}
                ref={follow.setLine(i)}
                className={cn('lyric-line shrink-0', !synced ? 'unsynced' : isCurrent ? 'current' : i < active ? 'past' : 'near')}
                style={{
                  // The setting is the ceiling, not a fixed size: a long line at
                  // full size used to run wider than its column and slide under
                  // the artwork, so the type now also tracks the viewport width.
                  fontSize: `min(${Math.round(L.size * 2.3)}px, 3.35vw)`,
                  lineHeight: 1.34,
                  transitionDuration: `${620 / L.speed}ms`,
                  textAlign: 'inherit',
                  // the motion setting only moves the lines that are not current
                  transform: isCurrent ? undefined
                    : L.motion === 'slide' ? 'translateY(8px)'
                      : L.motion === 'scale' ? 'scale(0.94)'
                        : undefined,
                  // "show next line" off: everything past the one coming up fades out
                  opacity: !L.showNext && i > active + 1 ? 0 : undefined,
                }}
              >
                {isCurrent && L.animate ? (
                  <KaraokeLine
                    text={line.text}
                    from={line.time}
                    to={nextLine ? nextLine.time : line.time + 6}
                    active
                  />
                ) : line.text}
                {/* the translation rides under its own line */}
                {L.translation && line.tr && (
                  <span className="mt-1 block font-normal" style={{ fontSize: '0.6em', opacity: 0.62 }}>{line.tr}</span>
                )}
              </div>
            )
          }) : (
            <div className="text-[13px]" style={{ color: 'var(--c-ink-faint)', opacity: L.opacity }}>
              ♪ instrumental — no synced lyrics
            </div>
          )}
        </div>

        {/* appear only when the listener has taken over the scroll */}
        <AnimatePresence>
          {!follow.following && lyrics.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={follow.resume}
              className="glass-soft absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[11.5px]"
              style={{ color: 'var(--c-ink-dim)' }}
            >
              跟随歌词
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* transport, floating above the room */}
      <div className="mt-auto w-full" style={{ maxWidth: 712, transform: 'translateZ(70px)' }}>
        <div className="np-glass-panel rounded-[26px] px-7 py-6">
          <ProgressBar />
          <div className="mt-5 flex items-center justify-center gap-3.5">
            <PlayModeButtons size={44} className="mr-1.5" />
            <button className="icon-btn h-14 w-14" onClick={() => player.prev()} aria-label="上一首"><IconPrev size={25} /></button>
            <button className="lg-btn lg-btn-primary grid h-20 w-20 place-items-center rounded-full" onClick={player.toggle} aria-label={player.isPlaying ? '暂停' : '播放'}>
              {player.isPlaying ? <IconPause size={32} /> : <IconPlay size={32} />}
            </button>
            <button className="icon-btn h-14 w-14" onClick={() => player.next()} aria-label="下一首"><IconNext size={25} /></button>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <button className="icon-btn h-11 w-11" onClick={() => song && lib.toggleFavSong(song.id)} aria-label="收藏" style={{ color: fav ? 'var(--c-accent-2)' : undefined }}>
              {fav ? <IconHeartFill size={21} /> : <IconHeart size={21} />}
            </button>
            <button className="icon-btn h-11 w-11" onClick={() => useUiStore.getState().navigate('album', { albumId })} aria-label="前往专辑">
              <IconDisc size={21} />
            </button>
            <div className="flex items-center gap-1.5">
              <button className="icon-btn h-11 w-11" onClick={player.toggleMute} aria-label="静音">
                {player.muted ? <IconVolumeMute size={19} /> : <IconVolume size={19} />}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={player.muted ? 0 : settings.settings.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="w-[118px]"
                style={{ ['--fill' as any]: `${(player.muted ? 0 : settings.settings.volume) * 100}%` }}
                aria-label="音量"
              />
            </div>
            <button className="icon-btn h-11 w-11" onClick={onOpenQueue} aria-label="打开播放队列"><IconQueue size={19} /></button>
            <button className="icon-btn h-11 w-11" onClick={() => useUiStore.getState().setRightTab('lyrics')} aria-label="歌词面板"><IconList size={19} /></button>
          </div>
          <Meters />
        </div>
      </div>
    </motion.div>
  )
}
