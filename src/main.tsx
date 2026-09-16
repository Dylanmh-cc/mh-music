import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import './styles/mh.css'

// Dev-only handles: the stores are module singletons, so poking them from the
// console is the only way to drive a flow whose entry point is a file picker
// (importing a track, restoring a lyric backup) without a real file. Vite
// replaces `import.meta.env.DEV` with false in production and this block is
// dropped from the bundle.
if (import.meta.env.DEV) {
  void (async () => {
    const [{ useLibraryStore }, { usePlayerStore }, { useUiStore }, { useSettingsStore }] = await Promise.all([
      import('./stores/library'),
      import('./stores/player'),
      import('./stores/ui'),
      import('./stores/settings'),
    ])
    ;(window as unknown as Record<string, unknown>).__mh = {
      library: useLibraryStore, player: usePlayerStore, ui: useUiStore, settings: useSettingsStore,
    }
  })()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
