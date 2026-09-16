import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useUiStore } from '../../stores/ui'
import { useIsMobile } from '../../hooks/useMedia'
import { StreetLayer } from '../AmbientStage'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { RightPanel } from '../panel/RightPanel'
import { ControlBar } from './ControlBar'
import { MobileNav } from './MobileNav'
import { ScanOverlay } from './ScanOverlay'
import { HomeView } from '../views/HomeView'
import { AlbumsView } from '../views/AlbumsView'
import { BrowseView } from '../views/BrowseView'
import { ArtistsView } from '../views/ArtistsView'
import { ArtistDetailView } from '../views/ArtistDetailView'
import { AlbumDetailView } from '../views/AlbumDetailView'
import { SongsView } from '../views/SongsView'
import { FavoritesView } from '../views/FavoritesView'
import { PlaylistsView } from '../views/PlaylistsView'
import { PlaylistDetailView } from '../views/PlaylistDetailView'
import { RecentView } from '../views/RecentView'
import { FoldersView } from '../views/FoldersView'
import { SettingsView } from '../views/SettingsView'

/**
 * Glass console shell: the whole interface sits inside one large floating
 * liquid-glass slab (`.app-frame`); the transport hangs over its bottom edge.
 */
export function AppShell() {
  const view = useUiStore((s) => s.view)
  const params = useUiStore((s) => s.params)
  const mobile = useIsMobile()
  const viewKey = view + (params.albumId ?? '') + (params.artistId ?? '') + (params.playlistId ?? '')

  // a fresh view always starts at the top of its own scroll
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
  }, [viewKey])

  return (
    <div className="relative z-10 flex h-full flex-col safe-bottom md:p-2.5">
      {/* the whole console floats inside one large liquid-glass slab; it always
          fills the viewport so the transport pill overlaps its bottom edge */}
      <div className="app-frame min-h-0 flex-1">
        {/* the street, inside the glass: behind the frame's blur it would be
            washed out to nothing, and this is what gives the console a place */}
        <StreetLayer className="street-inframe pointer-events-none absolute inset-0 z-0" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            {!mobile && <Sidebar />}
            <main className="min-w-0 flex-1 overflow-x-hidden scroll-silk" id="main-scroll">
              {/* enter-only transition: an interrupted exit animation used to stall
                  AnimatePresence mode="wait" and leave the old view on screen */}
              <motion.div
                key={viewKey}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-[1320px] px-5 pb-40 pt-3 md:px-9"
              >
                {view === 'home' && <HomeView />}
                {view === 'browse' && <BrowseView />}
                {view === 'albums' && <AlbumsView />}
                {view === 'artists' && <ArtistsView />}
                {view === 'artist' && <ArtistDetailView />}
                {view === 'album' && <AlbumDetailView />}
                {view === 'songs' && <SongsView />}
                {view === 'favorites' && <FavoritesView />}
                {view === 'playlists' && <PlaylistsView />}
                {view === 'playlist' && <PlaylistDetailView />}
                {view === 'recent' && <RecentView />}
                {view === 'folders' && <FoldersView />}
                {view === 'settings' && <SettingsView />}
              </motion.div>
            </main>
            {!mobile && <RightPanel />}
          </div>
        </div>
      </div>

      {/* floating transport pill */}
      <ControlBar />
      {mobile && <MobileNav />}
      <ScanOverlay />
    </div>
  )
}
