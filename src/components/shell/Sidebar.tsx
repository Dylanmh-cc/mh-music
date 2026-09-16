import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import type { ViewID } from '../../types/models'
import { MHLogo } from '../MHLogo'
import { IconHome, IconAlbum, IconArtist, IconNote, IconList, IconHeart, IconClock, IconFolder, IconSettings, IconSparkle, IconBack, IconForward } from '../icons'
import { cn } from '../../lib/format'

const MAIN: Array<{ id: ViewID; label: string; icon: (p: { size?: number }) => JSX.Element }> = [
  { id: 'home', label: '首页', icon: IconHome },
  { id: 'browse', label: '浏览', icon: IconSparkle },
  { id: 'albums', label: '专辑', icon: IconAlbum },
  { id: 'artists', label: '艺术家', icon: IconArtist },
  { id: 'songs', label: '歌曲', icon: IconNote },
  { id: 'playlists', label: '歌单', icon: IconList },
  { id: 'favorites', label: '收藏', icon: IconHeart },
  { id: 'recent', label: '最近播放', icon: IconClock },
  { id: 'folders', label: '文件夹', icon: IconFolder },
]

/**
 * Navigation rail — brand mark with a collapse control on top, the library
 * sections in the middle, Settings and the account pinned to the bottom.
 */
export function Sidebar() {
  const view = useUiStore((s) => s.view)
  const navigate = useUiStore((s) => s.navigate)
  const collapsed = useUiStore((s) => s.railCollapsed)
  const toggleRail = useUiStore((s) => s.toggleRail)
  const user = useAuthStore((s) => s.user)

  const active = (id: ViewID) =>
    view === id
    || (id === 'albums' && view === 'album')
    || (id === 'artists' && view === 'artist')
    || (id === 'playlists' && view === 'playlist')

  const item = (id: ViewID, label: string, Icon: (p: { size?: number }) => JSX.Element) => {
    const on = active(id)
    return (
      <button
        key={id}
        onClick={() => navigate(id)}
        title={collapsed ? label : undefined}
        aria-current={on ? 'page' : undefined}
        aria-label={label}
        className={cn('nav-rail-btn text-[14.5px]', on && 'is-active font-medium', collapsed && 'justify-center px-0')}
      >
        <span style={{ color: on ? 'var(--c-accent-2)' : 'inherit' }}>
          <Icon size={18} />
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    )
  }

  return (
    <nav
      className={cn('flex shrink-0 flex-col pb-32 pt-1 transition-[width] duration-300', collapsed ? 'w-[72px] px-2.5' : 'w-[224px] px-4')}
      aria-label="音乐库导航"
    >
      <div className={cn('mb-7 flex items-center gap-2.5', collapsed && 'flex-col gap-3')}>
        <MHLogo size={36} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold leading-none tracking-wide">MH Music</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--c-ink-faint)' }}>黑胶空间</div>
          </div>
        )}
        {!collapsed && <span className="flex-1" />}
        <button
          className="icon-btn h-8 w-8 shrink-0"
          onClick={toggleRail}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <IconForward size={15} /> : <IconBack size={15} />}
        </button>
      </div>

      <div className="scroll-silk -mx-1 flex-1 space-y-0.5 px-1">
        {MAIN.map(({ id, label, icon }) => item(id, label, icon))}
      </div>

      <div className="mt-3 space-y-1">
        {item('settings', '设置', IconSettings)}
        {user && (
          <div
            className={cn('mt-1 flex items-center gap-2.5 px-3 text-[13px]', collapsed && 'justify-center px-0')}
            style={{ color: 'var(--c-ink-faint)' }}
            title={collapsed ? user.name : undefined}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold"
              style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}
              aria-hidden="true"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            {!collapsed && <span className="truncate">{user.name}</span>}
          </div>
        )}
      </div>
    </nav>
  )
}
