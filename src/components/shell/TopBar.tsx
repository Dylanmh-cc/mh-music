import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { usePlayerStore } from '../../stores/player'
import { useLibraryStore } from '../../stores/library'
import { useIsMobile } from '../../hooks/useMedia'
import { IconBack, IconForward, IconSearch, IconSettings, IconLogout, IconExpand } from '../icons'

export function TopBar() {
  const mobile = useIsMobile()
  const back = useUiStore((s) => s.back)
  const canBack = useUiStore((s) => s.backStack.length > 0)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const toggleNowPlaying = useUiStore((s) => s.toggleNowPlaying)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useUiStore((s) => s.navigate)
  const user = useAuthStore((s) => s.user)
  const songId = usePlayerStore((s) => s.songId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const album = useLibraryStore((s) => {
    const song = s.songs.find((x) => x.id === songId)
    return song ? s.albums.find((a) => a.id === song.albumId) : undefined
  })

  return (
    <header className="flex items-center gap-3 px-4 pt-4 md:px-6" role="toolbar" aria-label="Top bar">
      {!mobile && (
        <div className="flex gap-1">
          <button className="icon-btn h-9 w-9 disabled:opacity-25" onClick={back} disabled={!canBack} aria-label="返回">
            <IconBack size={17} />
          </button>
          <button className="icon-btn h-9 w-9 opacity-25" disabled aria-label="Go forward">
            <IconForward size={17} />
          </button>
        </div>
      )}

      <button
        onClick={() => setSearchOpen(true)}
        className="glass-soft group mx-auto flex h-10 w-full max-w-[470px] items-center gap-3 rounded-full px-[18px] text-[13.5px] transition-all duration-300 hover:bg-white/8"
        aria-label="Search library (press /)"
      >
        <IconSearch size={16} />
        <span style={{ color: 'var(--c-ink-faint)' }}>搜索歌曲、艺术家、专辑…</span>
        <span className="ml-auto hidden rounded-md border border-white/10 px-2 py-0.5 text-[11px] md:inline" style={{ color: 'var(--c-ink-faint)' }}>/</span>
      </button>

      <div className="flex items-center gap-1.5">
        {!mobile && (
          <>
            {/* live record chip: album, track, spinning state */}
            {album && (
              <button
                onClick={() => toggleNowPlaying(true)}
                className="glass-soft group flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 transition hover:bg-white/8"
                aria-label="打开正在播放"
              >
                <span className="relative h-8 w-8 shrink-0">
                  <span className={`vinyl vinyl-spin block h-full w-full ${isPlaying ? '' : 'vinyl-paused'}`} />
                  <img src={album.coverUrl} alt="" className="absolute inset-[22%] rounded-full object-cover" />
                </span>
                <span className="hidden max-w-[180px] truncate text-[12.5px] lg:inline" style={{ color: 'var(--c-ink-dim)' }}>
                  {album.name}
                </span>
              </button>
            )}
            <button className="icon-btn h-9 w-9" onClick={() => toggleNowPlaying(true)} aria-label="打开全屏播放器">
              <IconExpand size={16} />
            </button>
          </>
        )}
        {user && (
          <div className="group relative">
            <button
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-white/6"
              aria-haspopup="menu"
              aria-label={`${user.name} 的账户菜单`}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold"
                style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}
              >
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[130px] truncate text-[13px] lg:inline">{user.name}</span>
            </button>
            <div className="glass-strong invisible absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl py-2 opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100" role="menu">
              <button className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] hover:bg-white/6" onClick={() => navigate('settings')} role="menuitem">
                <IconSettings size={16} /> Settings
              </button>
              <button className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13.5px] text-[#ff9a8a] hover:bg-[#ff9a8a]/10" onClick={logout} role="menuitem">
                <IconLogout size={16} /> 退出登录
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
