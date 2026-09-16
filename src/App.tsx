import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'
import { useSettingsStore } from './stores/settings'
import { useTheme } from './hooks/useTheme'
import { useHotkeys } from './hooks/useHotkeys'
import { useReducedMotion } from './hooks/useMedia'
import { AmbientStage } from './components/AmbientStage'
import { MHLogo } from './components/MHLogo'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IntroAnimation } from './components/intro/IntroAnimation'
import { Shell } from './app/Shell'
import { AuthScreen } from './components/auth/AuthScreen'
import { ToastHost } from './components/ToastHost'
import { ContextMenu } from './components/ContextMenu'
import { ConfirmDialog } from './components/ConfirmDialog'
import { SearchOverlay } from './components/search/SearchOverlay'
import { NowPlaying } from './components/player/NowPlaying'
import { readPath, pushPath } from './app/router'

export default function App() {
  const status = useAuthStore((s) => s.status)

  useEffect(() => { useAuthStore.getState().init() }, [])

  return (
    <ErrorBoundary>
      {status === 'loading' ? (
        <BootSplash />
      ) : status === 'anon' ? (
        <>
          <AmbientStage />
          <AuthScreen />
          <ToastHost />
        </>
      ) : (
        <PlayerApp />
      )}
    </ErrorBoundary>
  )
}

function PlayerApp() {
  useTheme()
  useHotkeys(true)
  const introDone = useUiStore((s) => s.introDone)
  const skipIntro = useSettingsStore((s) => s.settings.skipIntro)
  const animations = useSettingsStore((s) => s.settings.animations)
  const reduced = useReducedMotion()
  // the intro tells us when it starts fading, so the product can already be
  // there underneath: a cross-fade instead of a black gap between the two
  const [introLeaving, setIntroLeaving] = useState(false)
  const showIntro = !introDone && !skipIntro && !(reduced || !animations)

  // land on a real page: an empty address means home
  useEffect(() => {
    if (!window.location.hash) pushPath('/home', true)
  }, [])

  return (
    <>
      <AmbientStage paused={showIntro && !introLeaving} />
      <AnimatePresence>
        {showIntro && (
          <IntroAnimation
            key="intro"
            onLeaving={() => setIntroLeaving(true)}
            onDone={() => useUiStore.getState().setIntroDone(true)}
          />
        )}
      </AnimatePresence>
      <motion.div
        className="h-full"
        style={{ visibility: showIntro && !introLeaving ? 'hidden' : 'visible' }}
        initial={false}
        animate={{ opacity: 1 }}
      >
        <Shell />
      </motion.div>
      <SearchOverlay />
      <NowPlaying />
      <ContextMenu />
      <ConfirmDialog />
      <ToastHost />
    </>
  )
}

function BootSplash() {
  return (
    <div className="fixed inset-0 grid place-items-center" style={{ background: 'var(--c-deep-0)' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.25, 0.9, 0.25] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="text-center"
      >
        <MHLogo size={52} className="mx-auto mb-5" />
        <div className="mh-overline" style={{ color: 'var(--c-ink-dim)' }}>MH Music</div>
        <div className="mt-2 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>Music Beyond Sound.</div>
      </motion.div>
    </div>
  )
}

export { readPath }
