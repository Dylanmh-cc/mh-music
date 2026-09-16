import { forwardRef, useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../lib/format'

/**
 * The MH Music glass primitives. Everything visible in the rebuilt UI is
 * assembled from these two components, so the material, the radii, the motion
 * curves and the focus behaviour stay identical across every surface.
 */

type Tier = 'soft' | 'glass' | 'deep'

interface PanelProps extends HTMLMotionProps<'div'> {
  tier?: Tier
  /** adds the album-coloured light pooling inside the pane */
  lit?: boolean
  capsule?: boolean
  children?: ReactNode
}

export const GlassPanel = forwardRef<HTMLDivElement, PanelProps>(function GlassPanel(
  { tier = 'glass', lit = true, capsule = false, className, children, ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        tier === 'soft' ? 'mh-glass-soft' : tier === 'deep' ? 'mh-glass-deep' : 'mh-glass',
        capsule && 'mh-capsule',
        !lit && 'mh-nolit',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
})

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'glass' | 'accent' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

/** A liquid-glass button with a real ripple on press. */
export function GlassButton({ variant = 'glass', size = 'md', className, children, onClick, ...rest }: BtnProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; d: number }>>([])
  const next = useRef(1)

  const handle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const d = Math.max(r.width, r.height) * 2.1
    const id = next.current++
    setRipples((list) => [...list, { id, x: e.clientX - r.left, y: e.clientY - r.top, d }])
    window.setTimeout(() => setRipples((list) => list.filter((p) => p.id !== id)), 640)
    onClick?.(e)
  }, [onClick])

  return (
    <button
      data-variant={variant}
      onClick={handle}
      className={cn(
        'mh-btn',
        size === 'sm' && 'px-3.5 py-2 text-[12px]',
        size === 'lg' && 'px-6 py-3 text-[14px]',
        className,
      )}
      {...rest}
    >
      {ripples.map((p) => (
        <span key={p.id} className="mh-ripple" style={{ left: p.x, top: p.y, width: p.d, height: p.d }} />
      ))}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  )
}

/** A round glass icon button — always carries an accessible label + tooltip. */
export function IconButton({ label, active, className, children, ...rest }: {
  label: string
  active?: boolean
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-active={active ? 'true' : undefined}
      className={cn('mh-icon-btn', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
