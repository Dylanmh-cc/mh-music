import { Component, type ErrorInfo, type ReactNode } from 'react'
import { DEFAULT_PALETTE, applyTheme } from '../lib/color'

interface State { error: Error | null }

/**
 * Last line of defence: a render crash must never leave a black screen.
 * Offers a soft recovery (retry) and a hard reset of persisted state.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MHMusic] render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="fixed inset-0 grid place-items-center p-6" style={{ background: '#07080c' }}>
        <div className="glass w-full max-w-[440px] rounded-3xl p-7 text-center">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full vinyl"><div className="vinyl-label" /></div>
          <h1 className="text-[19px] font-semibold">The needle skipped.</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
            Something went wrong while rendering. Your library and playlists are safe — try again, or reset the
            visual state if it keeps happening.
          </p>
          <pre className="mt-4 max-h-[110px] overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            {String(error?.message ?? error)}
          </pre>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button className="lg-btn lg-btn-primary px-5 py-2.5 text-[13px] font-semibold" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button
              className="lg-btn px-5 py-2.5 text-[13px]"
              onClick={() => {
                applyTheme(DEFAULT_PALETTE)
                try {
                  const keep = Object.keys(localStorage).filter((k) => /:u:|session|users/.test(k))
                  const dump: Record<string, string> = {}
                  keep.forEach((k) => { dump[k] = localStorage.getItem(k) ?? '' })
                  localStorage.clear()
                  Object.entries(dump).forEach(([k, v]) => localStorage.setItem(k, v))
                } catch { /* ignore */ }
                location.reload()
              }}
            >
              Reset visuals & reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
