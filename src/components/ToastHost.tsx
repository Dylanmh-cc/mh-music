import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '../stores/ui'
import { IconAlert, IconCheck, IconInfo } from './icons'

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[300] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="glass flex items-center gap-3 rounded-full px-5 py-3 text-[13.5px]"
            role="status"
          >
            <span className="text-accent" style={{ color: t.kind === 'error' ? '#ff8f7a' : t.kind === 'success' ? 'var(--c-accent-2)' : 'var(--c-ink-dim)' }}>
              {t.kind === 'success' ? <IconCheck size={16} /> : t.kind === 'error' ? <IconAlert size={16} /> : <IconInfo size={16} />}
            </span>
            <span className="max-w-[74vw] truncate">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
