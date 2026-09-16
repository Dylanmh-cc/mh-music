import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { IconBack, IconForward } from '../icons'
import { cn } from '../../lib/format'

/**
 * The MH Music stage — one 3D card system used by every browse surface.
 *
 * A large centred card with its neighbours receding in perspective (scale /
 * rotateY / blur / opacity all fall off with distance). Drag, swipe, arrow keys
 * or the side arrows move it; the filmstrip jumps anywhere. Albums, artists,
 * playlists, songs and search results all render through here, so entering any
 * of them keeps the same spatial language instead of dropping into a plain list.
 */

const SPACING = 330
const SIDES = 3        // cards rendered either side of the centre
const FILMSTRIP = 9    // thumbnails either side of the centre

export interface StageCtx {
  index: number
  isCentre: boolean
  active: boolean
  activate: () => void
}

interface Props<T> {
  items: T[]
  keyOf: (item: T) => string
  /** what the strip under the stage shows for each item */
  thumbnailOf: (item: T) => string | undefined
  renderCard: (item: T, ctx: StageCtx) => React.ReactNode
  /** called when a card is clicked (never on drag) */
  onActivate?: (item: T, index: number) => void
  /** an externally driven centre, e.g. the song currently playing */
  followKey?: string | null
  label: string
  cardWidth?: number
  stageHeight?: number
  className?: string
}

export function Stage3D<T>({
  items, keyOf, thumbnailOf, renderCard, onActivate, followKey,
  label, cardWidth = 288, stageHeight = 520, className,
}: Props<T>) {
  const mx = useMotionValue(0)
  const [active, setActive] = useState(0)
  const justDragged = useRef(false)
  const followed = useRef<string | null>(null)

  // Responsive stage: measure the viewport so the centred sleeve never
  // overflows on narrow phones (where 320px would be wider than the screen).
  const viewportRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(1200)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Keep the sleeve inside the arrow buttons; shrink height with the card so
  // the title row never collides with the bottom transport + mobile nav.
  const effW = Math.min(cardWidth, Math.max(236, containerW - 88))
  // The viewport clips, so it has to be tall enough for the whole card *as
  // transformed*: the sleeve, the title block under it, the halo and the float.
  // It was sized from the sleeve alone, which cut the bottom of every card.
  const effH = Math.min(stageHeight, Math.max(440, effW + 240))

  const clamp = useCallback((i: number) => Math.max(0, Math.min(items.length - 1, i)), [items.length])

  // centre the stage on whatever is playing, but only when it actually changes
  // so browsing by drag or arrows is never yanked back
  useEffect(() => {
    if (!followKey || followKey === followed.current) return
    followed.current = followKey
    const idx = items.findIndex((it) => keyOf(it) === followKey)
    if (idx >= 0) animate(mx, -idx * SPACING, { type: 'spring', stiffness: 300, damping: 34 })
  }, [followKey, items, keyOf, mx])

  useEffect(() => mx.on('change', (v) => {
    const idx = clamp(Math.round(-v / SPACING))
    setActive((a) => (a === idx ? a : idx))
  }), [mx, clamp])

  const snapTo = useCallback((idx: number, activate = false) => {
    const i = clamp(idx)
    animate(mx, -i * SPACING, { type: 'spring', stiffness: 330, damping: 34 })
    if (activate) {
      const item = items[i]
      if (item) onActivate?.(item, i)
    }
  }, [mx, items, onActivate, clamp])

  if (!items.length) return null

  return (
    <div
      className={cn('relative mt-2 outline-none', className)}
      tabIndex={0}
      role="region"
      aria-label={`${label} —— 可拖动或使用方向键`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); snapTo(active + 1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); snapTo(active - 1) }
      }}
    >
      <div className="flex items-center gap-1.5 md:gap-3">
        <button
          className="glass-soft grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-white/10 disabled:opacity-20"
          onClick={() => snapTo(active - 1)}
          disabled={active === 0}
          aria-label="上一首"
        >
          <IconBack size={17} />
        </button>

        <div
          ref={viewportRef}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            height: effH,
            maskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)',
          }}
        >
          <motion.div
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
            drag="x"
            style={{ x: mx }}
            dragMomentum={false}
            dragElastic={0.085}
            onDragStart={() => { justDragged.current = true }}
            onDragEnd={(_, info) => {
              const v = mx.get()
              let idx = Math.round(-v / SPACING)
              if (Math.abs(info.velocity.x) > 480) idx += info.velocity.x < 0 ? 1 : -1
              snapTo(idx)
              setTimeout(() => { justDragged.current = false }, 0)
            }}
          >
            {items.map((item, i) => (
              Math.abs(i - active) > SIDES + 1 ? null : (
                <StageCard
                  key={keyOf(item)}
                  i={i}
                  dist={Math.abs(i - active)}
                  mx={mx}
                  width={effW}
                  justDragged={justDragged}
                  onSnap={snapTo}
                >
                  {renderCard(item, {
                    index: i,
                    isCentre: i === active,
                    active: i === active,
                    activate: () => { if (!justDragged.current) snapTo(i, true) },
                  })}
                </StageCard>
              )
            ))}
          </motion.div>
        </div>

        <button
          className="glass-soft grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-white/10 disabled:opacity-20"
          onClick={() => snapTo(active + 1)}
          disabled={active === items.length - 1}
          aria-label="下一首"
        >
          <IconForward size={17} />
        </button>
      </div>

      {/* position stencil */}
      <div className="mt-1 flex items-center justify-center gap-3" style={{ color: 'var(--c-ink-faint)' }}>
        <span className="track-stencil text-[11px]">{String(active + 1).padStart(2, '0')}</span>
        <span className="h-px w-10 bg-white/15" />
        <span className="track-stencil text-[11px]">{String(items.length).padStart(2, '0')}</span>
      </div>

      {/* filmstrip */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {items.map((item, i) => {
          if (Math.abs(i - active) > FILMSTRIP) return null
          const src = thumbnailOf(item)
          return (
            <button
              key={keyOf(item)}
              onClick={() => snapTo(i, true)}
              aria-label={`显示第 ${i + 1} 项`}
              aria-current={i === active ? 'true' : undefined}
              className={cn(
                'relative h-9 w-9 shrink-0 overflow-hidden rounded-md transition-all duration-300',
                i === active ? 'scale-110' : 'opacity-40 hover:opacity-80',
              )}
              style={i === active ? { boxShadow: '0 0 0 2px var(--c-accent), 0 8px 20px rgba(0,0,0,0.55)' } : undefined}
            >
              {src
                ? <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                : <span className="block h-full w-full" style={{ background: 'linear-gradient(140deg, #1a1d26, #0d0f15)' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Positions one card in the depth field. */
function StageCard({ i, dist, mx, width, justDragged, onSnap, children }: {
  i: number
  dist: number
  mx: MotionValue<number>
  width: number
  justDragged: MutableRefObject<boolean>
  onSnap: (idx: number) => void
  children: React.ReactNode
}) {
  const rel = useTransform(mx, (v) => v / SPACING + i)
  const scale = useTransform(rel, (r) => Math.max(0.52, 1 - Math.abs(r) * 0.155))
  const rotateY = useTransform(rel, (r) => Math.max(-52, Math.min(52, -r * 15)))
  const y = useTransform(rel, (r) => Math.abs(r) * 16)
  const opacity = useTransform(rel, (r) => (Math.abs(r) > SIDES + 0.4 ? 0 : Math.max(0, 1 - Math.abs(r) * 0.17)))
  const filter = useTransform(rel, (r) => `blur(${Math.min(6.5, Math.abs(r) * 2.1)}px)`)
  const pointerEvents = useTransform(rel, (r) => (Math.abs(r) > SIDES + 0.4 ? ('none' as const) : ('auto' as const)))

  return (
    <motion.div
      className="absolute top-1/2 select-none"
      style={{
        left: '50%',
        marginLeft: -width / 2,
        marginTop: -(width * 0.62),
        width,
        x: i * SPACING,
        transformPerspective: 1100,
        scale,
        rotateY,
        y,
        opacity,
        filter,
        pointerEvents,
        zIndex: 40 - dist,
      }}
      onClick={() => { if (!justDragged.current) onSnap(i) }}
    >
      <div
        className="glass rounded-[24px] p-3 transition-shadow duration-500"
        style={{
          boxShadow: dist === 0
            ? '0 34px 80px rgba(0,0,0,0.6), 0 0 46px var(--c-glow-soft), inset 0 1px 0 rgba(255,255,255,0.16)'
            : undefined,
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}

/** The shared card interior, so every stage reads as one system. */
export function StageCardBody({
  art, title, subtitle, sub2, badge, actions, onActivate, artLabel,
}: {
  art: React.ReactNode
  title: string
  subtitle?: string
  sub2?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  onActivate?: () => void
  artLabel?: string
}) {
  return (
    <>
      <div
        className="relative cursor-pointer overflow-hidden rounded-[16px]"
        style={{ aspectRatio: '1 / 1' }}
        onClick={onActivate}
        role={onActivate ? 'button' : undefined}
        aria-label={artLabel}
      >
        {art}
        <span className="pointer-events-none absolute inset-0 rounded-[16px]" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)' }} />
        {badge}
      </div>

      <div className="cursor-pointer px-1.5 pb-0.5 pt-3.5" onClick={onActivate}>
        <div className="truncate text-[16px] font-semibold tracking-tight">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>{subtitle}</div>}
        {sub2 && <div className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>{sub2}</div>}
      </div>

      <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-2.5">{actions}</div>
    </>
  )
}
