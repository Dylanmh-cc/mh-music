import { cn } from '../lib/format'

/**
 * MH monogram — the MH Music brand mark.
 * A minimal glass badge whose glow quietly follows the current album theme
 * via the global `--c-glow` custom property.
 */
export function MHLogo({
  size = 34,
  className,
  glow = true,
}: {
  size?: number
  className?: string
  glow?: boolean
}) {
  return (
    <span
      className={cn('relative grid shrink-0 select-none place-items-center', className)}
      style={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.3)}px`,
        background:
          'linear-gradient(150deg, rgba(255,255,255,0.17), rgba(255,255,255,0.045) 52%, rgba(255,255,255,0.09))',
        border: '1px solid rgba(255,255,255,0.16)',
        backdropFilter: 'blur(8px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
        boxShadow: glow
          ? '0 0 20px var(--c-glow-soft), inset 0 1px 0 rgba(255,255,255,0.24), 0 5px 16px rgba(0,0,0,0.42)'
          : 'inset 0 1px 0 rgba(255,255,255,0.24), 0 5px 16px rgba(0,0,0,0.42)',
      }}
      aria-hidden="true"
    >
      <span
        className="font-semibold leading-none"
        style={{
          fontSize: Math.round(size * 0.33),
          letterSpacing: '0.03em',
          color: 'var(--c-ink)',
          textShadow: '0 0 14px var(--c-glow)',
        }}
      >
        MH
      </span>
    </span>
  )
}
