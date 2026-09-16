import { useMemo, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'
import { changePassword } from '../services/auth'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton } from '../components/glass/GlassPanel'
import { IconUser, IconLogout, IconHeart, IconList, IconAlbum, IconNote } from '../components/icons'

/**
 * Profile — the account, what it holds, and the door out. Each account owns a
 * private slice of the library, so this is also where that isolation is made
 * visible.
 */
export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const settings = useSettingsStore()

  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => ([
    { label: '曲目', value: lib.songs.length, icon: IconNote },
    { label: '专辑', value: lib.albums.length, icon: IconAlbum },
    { label: '艺术家', value: lib.artists.length, icon: IconUser },
    { label: '歌单', value: lib.playlists.length, icon: IconList },
    { label: '收藏', value: lib.favorites.songs.length + lib.favorites.albums.length + lib.favorites.artists.length, icon: IconHeart },
    { label: '文件夹', value: lib.folders.length, icon: IconAlbum },
  ]), [lib])

  if (!user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-[13.5px]" style={{ color: 'var(--c-ink-dim)' }}>你已退出登录。</p>
          <GlassButton className="mt-4" variant="accent" onClick={() => pushPath('/login')}>登录</GlassButton>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[860px] pb-6">
      <header className="flex flex-wrap items-center gap-5 py-2">
        <span
          className="grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full text-[34px] font-semibold"
          style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}
          aria-hidden="true"
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="mh-display text-[27px] leading-tight">{user.name}</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>{user.email}</p>
          <p className="mh-overline mt-2" style={{ color: 'var(--c-ink-faint)' }}>
            注册于 {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </header>

      <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <GlassPanel key={s.label} tier="soft" className="flex items-center gap-3 rounded-2xl p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--c-tint)', color: 'var(--c-accent-2)' }}>
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="mh-mono block text-[19px] leading-none">{s.value}</span>
                <span className="mt-1 block text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>{s.label}</span>
              </span>
            </GlassPanel>
          )
        })}
      </section>

      <section className="mt-7">
        <h2 className="mh-display mb-3 text-[16px]">修改密码</h2>
        <GlassPanel tier="soft" className="rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="password" placeholder="当前密码" value={cur} onChange={(e) => setCur(e.target.value)}
              className="w-[190px] rounded-xl bg-white/5 px-3.5 py-2.5 text-[13px] outline-none placeholder:text-white/25"
              aria-label="当前密码"
            />
            <input
              type="password" placeholder="新密码" value={next} onChange={(e) => setNext(e.target.value)}
              className="w-[190px] rounded-xl bg-white/5 px-3.5 py-2.5 text-[13px] outline-none placeholder:text-white/25"
              aria-label="新密码"
            />
            <GlassButton
              disabled={busy}
              onClick={async () => {
                setMsg('')
                setBusy(true)
                try {
                  await changePassword(user.id, cur, next)
                  setMsg('密码已更新。')
                  setCur(''); setNext('')
                } catch (e: any) {
                  setMsg(e?.message ?? '密码更新失败。')
                } finally { setBusy(false) }
              }}
            >
              更新密码
            </GlassButton>
            {msg && <span className="text-[12px]" style={{ color: 'var(--c-accent-2)' }}>{msg}</span>}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
            密码只以 PBKDF2-SHA256 加每个账户独立盐值的哈希保存 —— 绝不保存明文。
          </p>
        </GlassPanel>
      </section>

      <section className="mt-7">
        <h2 className="mh-display mb-3 text-[16px]">这个账户的数据</h2>
        <GlassPanel tier="soft" className="rounded-2xl p-4">
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
            音乐库、收藏、歌单、播放历史、主题、歌词偏好与专辑布局,都保存在你自己的命名空间下。
            其他账户在同一浏览器登录,看不到其中任何内容。
          </p>
          <p className="mh-mono mt-3 text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>
            {settings.settings.theme} · {settings.settings.bgMode} 房间 · {settings.settings.visual.density} 地貌
            {player.songId ? ` · 上次播放 ${lib.getSong(player.songId)?.title ?? ''}` : ''}
          </p>
        </GlassPanel>
      </section>

      <div className="mt-8">
        <GlassButton size="lg" onClick={logout}><IconLogout size={15} /> 退出登录</GlassButton>
      </div>
    </div>
  )
}
