import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '../stores/ui'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { useAuthStore } from '../stores/auth'
import { useIsMobile } from '../hooks/useMedia'
import { cn } from '../lib/format'
import { isNowPlaying, pathToView, pushPath, readPath, useRoute, viewToPath, NOW_PLAYING_PATH, PROFILE_PATH } from './router'
import { GlassPanel } from '../components/glass/GlassPanel'
import { PlayerDock } from '../components/PlayerDock'
import { QueuePanel } from '../components/QueuePanel'
import { HomePage } from '../pages/HomePage'
import { ProfilePage } from '../pages/ProfilePage'
import { MHLogo } from '../components/MHLogo'
import {
  IconHome, IconAlbum, IconArtist, IconNote, IconList, IconHeart, IconSettings,
  IconUser, IconSearch, IconClose, IconFolder, IconVinyl, IconSparkle, IconWave, IconImport,
} from '../components/icons'
import type { ViewID } from '../types/models'

/* The legacy views still hosting themselves inside the new frame. They are
   rebuilt one by one; everything around them (chrome, dock, queue, routing)
   is already the new system. */
import { AlbumsView } from '../components/views/AlbumsView'
import { ArtistsView } from '../components/views/ArtistsView'
import { PlaylistsView } from '../components/views/PlaylistsView'
import { FavoritesView } from '../components/views/FavoritesView'
import { SongsView } from '../components/views/SongsView'
import { SettingsView } from '../components/views/SettingsView'
import { FoldersView } from '../components/views/FoldersView'
import { RecentView } from '../components/views/RecentView'
import { AlbumDetailView } from '../components/views/AlbumDetailView'
import { ArtistDetailView } from '../components/views/ArtistDetailView'
import { PlaylistDetailView } from '../components/views/PlaylistDetailView'
import { BrowsePage } from '../pages/BrowsePage'
import { ImportPage } from '../pages/ImportPage'
import { VisualizerPage } from '../pages/VisualizerPage'

interface RailItem { view: ViewID; label: string; icon: (p: { size?: number }) => JSX.Element; path: string }

/** The eight destinations from the product spec, in order, then the account
 *  entries pinned to the bottom of the rail. Songs is not here on purpose: the
 *  track list lives on the home page as a stack, and `/songs` stays reachable
 *  from there and from the address bar. */
const RAIL: RailItem[] = [
  { view: 'home', label: 'Home', icon: IconHome, path: '/home' },
  { view: 'browse', label: 'Browse', icon: IconSparkle, path: '/browse' },
  { view: 'albums', label: 'Albums', icon: IconAlbum, path: '/albums' },
  { view: 'artists', label: 'Artists', icon: IconArtist, path: '/artists' },
  { view: 'playlists', label: 'Playlists', icon: IconList, path: '/playlists' },
  { view: 'favorites', label: 'Favorites', icon: IconHeart, path: '/favorites' },
  { view: 'recent', label: 'Recently Played', icon: IconVinyl, path: '/recently-played' },
  { view: 'folders', label: 'Folders', icon: IconFolder, path: '/folders' },
]

/**
 * The rebuilt shell.
 *
 * Everything hangs in one 3D room: a hover-expanding icon rail on the left,
 * the page in the middle (the home route is a full-bleed floating gallery, the
 * rest live on a glass pane), the queue sliding in from the right and a
 * floating dock at the bottom. Navigation is driven by the address bar.
 */
export function Shell() {
  const route = useRoute()
  const view = useUiStore((s) => s.view)
  const params = useUiStore((s) => s.params)
  const mobile = useIsMobile()
  const open = useUiStore((s) => s.nowPlayingOpen)
  const closeNowPlaying = useUiStore((s) => s.toggleNowPlaying)
  const [queueOpen, setQueueOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  /* ── address ⇄ player navigation ──────────────────────────────────────── */
  // adopt the address we were opened with
  useEffect(() => {
    if (isNowPlaying(readPath())) return
    const next = pathToView(readPath())
    useUiStore.setState({ view: next.view, params: next.params })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // view changes write the address (replace: browsing is not a history entry)
  useEffect(() => {
    if (isNowPlaying(readPath())) return
    pushPath(viewToPath(view, params), true)
  }, [view, params])

  // back / forward reads it back
  useEffect(() => {
    if (isNowPlaying(route)) return
    const next = pathToView(route)
    if (next.view !== useUiStore.getState().view) useUiStore.setState({ view: next.view, params: next.params })
  }, [route])

  // /now-playing is a route, and the space is a full-screen page on it
  useEffect(() => {
    const want = isNowPlaying(route)
    if (want !== useUiStore.getState().nowPlayingOpen) useUiStore.getState().toggleNowPlaying(want)
    if (want) setQueueOpen(false)
  }, [route])
  useEffect(() => {
    if (!open && isNowPlaying(readPath())) pushPath(viewToPath(view, params), true)
  }, [open, view, params])

  const page = useMemo(() => {
    switch (view) {
      case 'home': return <HomePage />
      case 'browse': return <Wrap><BrowsePage /></Wrap>
      case 'albums': return <Wrap><AlbumsView /></Wrap>
      case 'artists': return <Wrap><ArtistsView /></Wrap>
      case 'songs': return <Wrap><SongsView /></Wrap>
      case 'playlists': return <Wrap><PlaylistsView /></Wrap>
      case 'favorites': return <Wrap><FavoritesView /></Wrap>
      case 'recent': return <Wrap><RecentView /></Wrap>
      case 'folders': return <Wrap><FoldersView /></Wrap>
      case 'import': return <Wrap><ImportPage /></Wrap>
      case 'visualizer': return <Wrap><VisualizerPage /></Wrap>
      case 'settings': return <Wrap><SettingsView /></Wrap>
      case 'album': return <Wrap><AlbumDetailView /></Wrap>
      case 'artist': return <Wrap><ArtistDetailView /></Wrap>
      case 'playlist': return <Wrap><PlaylistDetailView /></Wrap>
      default: return <HomePage />
    }
  }, [view])

  const isProfile = route.replace(/^\/+/, '') === 'profile'

  return (
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex min-h-0 flex-1 gap-4 p-4 pb-0">
        {!mobile && <NavRail />}

        <div className="relative min-w-0 flex-1">
          {isProfile ? (
            <GlassPanel className="h-full overflow-hidden">
              <main className="mh-scroll h-full px-7 py-6"><ProfilePage /></main>
            </GlassPanel>
          ) : view === 'home' ? (
            // the gallery is the room itself — full bleed, nothing wrapping it
            <main className="mh-scroll h-full pr-1">{page}</main>
          ) : (
            <GlassPanel className="h-full overflow-hidden">
              <main className="mh-scroll h-full px-7 py-6">{page}</main>
            </GlassPanel>
          )}
        </div>

        <AnimatePresence>
          {/* On the home route the queue is part of the page, so the panel is
              not shown there — it would be the same list twice. */}
          {queueOpen && !mobile && view !== 'home' && <QueuePanel onClose={() => setQueueOpen(false)} />}
        </AnimatePresence>
      </div>

      <PlayerDock
        onToggleQueue={() => setQueueOpen((v) => !v)}
        queueOpen={queueOpen}
        onSearch={() => setSearchOpen(true)}
        onOpenSpace={() => pushPath(NOW_PLAYING_PATH)}
        spaceOpen={open}
        onCloseSpace={() => closeNowPlaying(false)}
      />
      {mobile && <MobileBar onSearch={() => setSearchOpen(true)} />}

      {/* the search overlay is shared with the old chrome; the trigger is new */}
      <SearchLauncher open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

/** a page that is not the gallery sits on a glass pane with room to breathe */
function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px]">{children}</div>
}

function NavRail() {
  const view = useUiStore((s) => s.view)
  const route = useRoute()
  const navigate = useUiStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)

  const isActive = (item: RailItem) =>
    view === item.view
    || (item.view === 'albums' && view === 'album')
    || (item.view === 'artists' && view === 'artist')
    || (item.view === 'playlists' && view === 'playlist')

  return (
    <GlassPanel tier="glass" className="mh-rail" lit={false}>
      <div className="mb-2 flex h-11 items-center gap-3 px-[7px]">
        <MHLogo size={30} />
        <span className="mh-rail-label mh-display truncate text-[15px] leading-none">
          MH Music
          <span className="mh-overline mt-1 block" style={{ color: 'var(--c-ink-faint)' }}>Beyond sound</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {RAIL.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              className="mh-rail-item"
              data-active={isActive(item) ? 'true' : undefined}
              aria-current={isActive(item) ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => { navigate(item.view); pushPath(item.path) }}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center"><Icon size={19} /></span>
              <span className="mh-rail-label text-[13.5px]">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--mh-hairline)' }}>
        <button
          className="mh-rail-item"
          data-active={view === 'visualizer' ? 'true' : undefined}
          aria-label="Visualizer"
          title="Visualizer"
          onClick={() => { useUiStore.getState().navigate('visualizer'); pushPath('/visualizer') }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center"><IconWave size={18} /></span>
          <span className="mh-rail-label text-[13.5px]">Visualizer</span>
        </button>
        <button
          className="mh-rail-item"
          data-active={view === 'import' ? 'true' : undefined}
          aria-label="Import playlist"
          title="Import playlist"
          onClick={() => { useUiStore.getState().navigate('import'); pushPath('/import') }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center"><IconImport size={18} /></span>
          <span className="mh-rail-label text-[13.5px]">Import</span>
        </button>
        <button
          className="mh-rail-item"
          data-active={view === 'settings' ? 'true' : undefined}
          aria-label="Settings"
          title="Settings"
          onClick={() => { useUiStore.getState().navigate('settings'); pushPath('/settings') }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center"><IconSettings size={18} /></span>
          <span className="mh-rail-label text-[13.5px]">Settings</span>
        </button>
        <button
          className="mh-rail-item"
          data-active={route.replace(/^\/+/, '') === 'profile' ? 'true' : undefined}
          aria-label="Profile"
          title="Profile"
          onClick={() => pushPath(PROFILE_PATH)}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center">
            {user
              ? <span className="grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-bold" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>{user.name.slice(0, 1).toUpperCase()}</span>
              : <IconUser size={18} />}
          </span>
          <span className="mh-rail-label text-[13.5px]">{user?.name ?? 'Profile'}</span>
        </button>
      </div>
    </GlassPanel>
  )
}

/** mobile: one floating row of the same destinations */
function MobileBar({ onSearch }: { onSearch: () => void }) {
  const view = useUiStore((s) => s.view)
  const navigate = useUiStore((s) => s.navigate)
  const items: Array<{ key: string; label: string; icon: (p: { size?: number }) => JSX.Element; run: () => void }> = [
    { key: 'home', label: 'Home', icon: IconHome, run: () => navigate('home') },
    { key: 'albums', label: 'Albums', icon: IconAlbum, run: () => navigate('albums') },
    { key: 'search', label: 'Search', icon: IconSearch, run: onSearch },
    { key: 'favorites', label: 'Favorites', icon: IconHeart, run: () => navigate('favorites') },
    { key: 'settings', label: 'Settings', icon: IconSettings, run: () => navigate('settings') },
  ]
  return (
    <nav className="fixed inset-x-3 bottom-[116px] z-[65] md:hidden" aria-label="Mobile navigation">
      <GlassPanel tier="deep" capsule className="flex items-stretch justify-around p-1.5">
        {items.map((t) => {
          const Icon = t.icon
          const on = view === t.key
          return (
            <button
              key={t.key}
              onClick={t.run}
              aria-label={t.label}
              aria-current={on ? 'page' : undefined}
              className={cn('flex flex-1 flex-col items-center gap-1 rounded-full py-2 text-[10.5px] transition-colors')}
              style={{ color: on ? 'var(--c-accent-2)' : 'var(--c-ink-faint)' }}
            >
              <Icon size={21} />
              {t.label}
            </button>
          )
        })}
      </GlassPanel>
    </nav>
  )
}

/**
 * The shared search overlay is still the legacy component; this launcher just
 * gives the new chrome a way to open it (and keeps the old top bar working).
 */
function SearchLauncher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setOpen = useUiStore((s) => s.setSearchOpen)
  useEffect(() => { if (open) { setOpen(true); onClose() } }, [open, setOpen, onClose])
  return null
}

export { IconClose }
