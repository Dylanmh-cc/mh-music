import { useLibraryStore } from '../../stores/library'
import { AnimatePresence, motion } from 'framer-motion'
import { fmtTime } from '../../lib/format'

/** Floating "Scanning your music library…" card with live progress. */
export function ScanOverlay() {
  const scan = useLibraryStore((s) => s.scan)
  const pct = scan && scan.total > 0 ? scan.done / scan.total : 0
  return (
    <AnimatePresence>
      {scan?.active && (
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="glass-strong fixed bottom-24 left-5 z-[240] w-[300px] rounded-3xl p-4 md:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="vinyl h-10 w-10 vinyl-spin shrink-0"><div className="vinyl-label" /></div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium">正在扫描你的音乐库…</div>
              <div className="truncate text-[11px]" style={{ color: 'var(--c-ink-dim)' }}>
                {scan.folderName}{scan.current ? ` · ${scan.current}` : ''}
              </div>
            </div>
            <div className="ml-auto text-[12px] tabular-nums" style={{ color: 'var(--c-ink-dim)' }}>
              {scan.total ? `${scan.done}/${scan.total}` : '…'}
            </div>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-2))', boxShadow: '0 0 10px var(--c-glow)' }}
              animate={{ width: `${Math.max(6, pct * 100)}%` }}
              transition={{ ease: 'easeOut', duration: 0.4 }}
            />
          </div>
          <div className="mt-2 text-[10px]" style={{ color: 'var(--c-ink-faint)' }}>
            正在读取标签 · 封面 · 时长{pct > 0 ? ` · 预计 ${fmtTime(pct * 40)}` : ''}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
