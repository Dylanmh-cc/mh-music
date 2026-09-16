import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '../stores/ui'
import type { CtxItem } from '../types/models'

export function ContextMenu() {
  const ctx = useUiStore((s) => s.ctx)
  const close = useUiStore((s) => s.closeCtx)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ctx) return
    // close only on interactions outside the menu (capture-phase window
    // listeners would otherwise close it before a menu item's own click fires)
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onViewportChange = () => close()
    // A long list (the song menu has fourteen rows) scrolls *inside* the menu,
    // and the "添加到歌单" flyout has its own scrollbar — that wheel is the user
    // reading the menu, not dismissing it.
    const onWheel = (e: WheelEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      close()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('wheel', onWheel)
    }
  }, [ctx, close])

  if (!ctx) return null
  const x = Math.min(ctx.x, window.innerWidth - 258)
  // the menu is capped to the viewport and scrolls, so the estimate only has to
  // keep it on screen — the old flat guess of 430px put the last rows of a long
  // menu below the fold with no way to reach them
  const estimated = ctx.items.reduce((h, it) => h + (it.sep ? 17 : 41), 16)
  const maxH = Math.max(180, window.innerHeight - 24)
  const y = Math.max(12, Math.min(ctx.y, window.innerHeight - Math.min(estimated, maxH) - 12))

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        // no `overflow-hidden`: the submenus are flyouts that sit *outside* this
        // box, and clipping the container made every one of them invisible —
        // which is why they appeared not to open at all
        className="glass-strong fixed z-[260] min-w-[256px] rounded-2xl py-2"
        style={{ left: x, top: y, maxHeight: maxH, overflowY: 'auto' }}
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {ctx.items.map((item, i) => (
          <MenuRow key={i} item={item} close={close} depth={0} flip={x + 256 + 210 > window.innerWidth} />
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

function MenuRow({ item, close, depth, flip }: { item: CtxItem; close: () => void; depth: number; flip: boolean }) {
  const [open, setOpen] = useSubmenu()
  if (item.sep) return <div className="divider my-2" />
  if (!item.label) return null
  return (
    <div className="relative">
      <button
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[13.5px] transition-colors hover:bg-white/6 disabled:opacity-40 ${item.danger ? 'text-[#ff9a8a] hover:bg-[#ff9a8a]/10' : ''}`}
        disabled={item.disabled}
        role="menuitem"
        aria-haspopup={item.submenu ? 'menu' : undefined}
        aria-expanded={item.submenu ? open : undefined}
        onClick={() => {
          if (item.submenu) { setOpen(!open); return }
          close()
          item.action?.()
        }}
        onMouseEnter={() => item.submenu && setOpen(true)}
      >
        <span className="truncate">{item.label}</span>
        {item.submenu && <span className="pl-3 opacity-50 text-[12px]">›</span>}
      </button>
      {item.submenu && open && (
        <motion.div
          className="glass-strong absolute top-[-6px] min-w-[205px] rounded-2xl py-2"
          // flip to the other side when there is no room, the way the parent
          // menu already does for its own edges
          style={
            (depth === 0 ? !flip : flip)
              ? { left: 'calc(100% + 4px)', maxHeight: 300, overflowY: 'auto' }
              : { right: 'calc(100% + 4px)', maxHeight: 300, overflowY: 'auto' }
          }
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.14 }}
        >
          {item.submenu.map((sub, i) => (
            <MenuRow key={i} item={sub} close={close} depth={depth + 1} flip={flip} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function useSubmenu(): [boolean, (v: boolean) => void] {
  return useState(false)
}
