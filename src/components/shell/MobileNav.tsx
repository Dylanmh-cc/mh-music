import { useUiStore } from '../../stores/ui'
import type { ViewID } from '../../types/models'
import { IconHome, IconAlbum, IconSearch, IconHeart, IconSettings } from '../icons'

const TABS: Array<{ id: ViewID | 'search'; label: string; icon: (p: { size?: number }) => JSX.Element }> = [
  { id: 'home', label: 'Home', icon: IconHome },
  { id: 'albums', label: 'Albums', icon: IconAlbum },
  { id: 'search', label: 'Search', icon: IconSearch },
  { id: 'favorites', label: 'Favorites', icon: IconHeart },
  { id: 'settings', label: 'Settings', icon: IconSettings },
]

export function MobileNav() {
  const view = useUiStore((s) => s.view)
  const navigate = useUiStore((s) => s.navigate)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)

  return (
    <nav
      className="glass-pill fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around rounded-3xl md:hidden"
      aria-label="Mobile navigation"
    >
      {TABS.map((t) => {
        const Icon = t.icon
        const active = view === t.id
        return (
          <button
            key={t.id}
            className="relative flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] transition-colors"
            style={{ color: active ? 'var(--c-accent-2)' : 'var(--c-ink-faint)' }}
            aria-label={t.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => (t.id === 'search' ? setSearchOpen(true) : navigate(t.id as ViewID))}
          >
            <Icon size={22} />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
