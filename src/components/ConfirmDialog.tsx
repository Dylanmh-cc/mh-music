import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '../stores/ui'
import { cn } from '../lib/format'
import { IconTrash } from './icons'

/**
 * Liquid-glass confirmation. Replaces window.confirm so every destructive
 * action (remove song, delete album, drop a folder, clear history) reads as
 * part of the same interface instead of a browser chrome dialog.
 */
export function ConfirmDialog() {
  const spec = useUiStore((s) => s.confirm)
  const close = useUiStore((s) => s.closeConfirm)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!spec) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
      if (e.key === 'Enter') { e.preventDefault(); spec.onConfirm(); close() }
    }
    window.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => confirmRef.current?.focus(), 80)
    return () => { window.removeEventListener('keydown', onKey, true); clearTimeout(t) }
  }, [spec, close])

  return (
    <AnimatePresence>
      {spec && (
        <motion.div
          key="confirm"
          className="fixed inset-0 z-[260] grid place-items-center px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label={spec.title}
        >
          <button
            className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-md"
            onClick={close}
            aria-label="取消"
            tabIndex={-1}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass glass-strong relative w-full max-w-[420px] rounded-[26px] p-6"
          >
            {spec.danger && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 -top-px h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,120,120,0.7), transparent)' }}
              />
            )}
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{
                background: spec.danger ? 'rgba(255,96,96,0.14)' : 'var(--c-tint)',
                color: spec.danger ? '#ff9a9a' : 'var(--c-accent-2)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              <IconTrash size={20} />
            </div>

            <h2 className="mt-4 text-[18px] font-semibold leading-snug tracking-tight">{spec.title}</h2>
            {spec.body && (
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{spec.body}</p>
            )}

            {spec.extra && (
              <button
                onClick={() => {
                  spec.extra!.onSelect()
                  // The secondary choice can open a confirmation of its own —
                  // deleting the real file asks a second time, on purpose. Only
                  // dismiss this dialog when it did not replace itself.
                  if (useUiStore.getState().confirm === spec) close()
                }}
                className="mt-4 flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors duration-200 hover:bg-white/8"
                style={{ border: '1px solid rgba(255,120,120,0.26)', background: 'rgba(255,96,96,0.07)' }}
              >
                <IconTrash size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium" style={{ color: '#ffb3b3' }}>{spec.extra.label}</span>
                  {spec.extra.hint && (
                    <span className="mt-1 block text-[12px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>{spec.extra.hint}</span>
                  )}
                </span>
              </button>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                className="lg-btn px-6 py-3 text-[13.5px] font-medium"
                onClick={close}
              >
                {spec.cancelLabel ?? '取消'}
              </button>
              <button
                ref={confirmRef}
                className={cn('lg-btn px-6 py-3 text-[13.5px] font-semibold', !spec.danger && 'lg-btn-primary')}
                style={spec.danger ? {
                  background: 'linear-gradient(160deg, #ff6a6a, #d8392f 60%, #a81f1a)',
                  borderColor: 'rgba(255,255,255,0.24)',
                  color: '#fff',
                  boxShadow: '0 12px 34px rgba(255,80,80,0.35), inset 0 1px 0 rgba(255,255,255,0.34)',
                } : undefined}
                onClick={() => { spec.onConfirm(); close() }}
              >
                {spec.confirmLabel ?? '确认'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
