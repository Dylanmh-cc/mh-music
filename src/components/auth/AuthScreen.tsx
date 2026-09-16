import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/auth'
import { requestResetCode, resetPassword } from '../../services/auth'
import { IconVinyl } from '../icons'
import { MHLogo } from '../MHLogo'

type Mode = 'login' | 'register' | 'forgot'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  return (
    <div className="relative z-10 grid h-full place-items-center overflow-y-auto p-6 scroll-silk">
      <div className="grid w-full max-w-[940px] items-center gap-14 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="hidden md:block"
        >
          <div className="floaty mx-auto mb-8 h-32 w-32">
            <div className="vinyl h-full w-full vinyl-slow">
              <div className="vinyl-label" />
            </div>
          </div>
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">
            MH Music
          </h1>
          <p className="mt-3 max-w-[380px] text-[15px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
            一座数字黑胶收藏馆。液态玻璃、由专辑生出的光,
            以及一个随音乐呼吸的空间。
          </p>
          <div className="mt-8 flex items-center gap-2 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>
            <IconVinyl size={14} />
            你的音乐库、收藏与歌单只属于你自己的账户。
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="glass rounded-[28px] p-8"
        >
          <div className="mb-6 flex items-center gap-2.5 text-center md:hidden">
            <MHLogo size={38} />
            <span className="text-lg font-semibold tracking-wide">MH Music</span>
          </div>
          {mode === 'login' && <LoginForm go={setMode} />}
          {mode === 'register' && <RegisterForm go={setMode} />}
          {mode === 'forgot' && <ForgotForm go={setMode} />}
        </motion.div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] outline-none transition placeholder:text-white/25 focus:border-white/25 focus:bg-white/8'

function LoginForm({ go }: { go: (m: Mode) => void }) {
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setErr('')
        try { await login(email, password, remember) } catch (ex: any) { setErr(ex.message ?? '登录失败') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">欢迎回来</h2>
      <input className={inputCls} placeholder="邮箱" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={inputCls} placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      <div className="flex items-center justify-between text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--c-accent)]" />
          记住我
        </label>
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => go('forgot')}>
          忘记密码?
        </button>
      </div>
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? '正在登录…' : '登录'}
      </button>
      <p className="pt-1 text-center text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        还没有账号?{' '}
        <button type="button" className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--c-accent-2)' }} onClick={() => go('register')}>
          创建账户
        </button>
      </p>
    </form>
  )
}

function RegisterForm({ go }: { go: (m: Mode) => void }) {
  const register = useAuthStore((s) => s.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setErr('')
        try { await register(name, email, password) } catch (ex: any) { setErr(ex.message ?? '注册失败') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">建立你的收藏馆</h2>
      <input className={inputCls} placeholder="昵称" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      <input className={inputCls} placeholder="邮箱" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={inputCls} placeholder="密码(至少 6 位)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? '正在创建…' : '创建账户'}
      </button>
      <p className="pt-1 text-center text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        已经有账号了?{' '}
        <button type="button" className="underline-offset-2 hover:underline" style={{ color: 'var(--c-accent-2)' }} onClick={() => go('login')}>
          登录
        </button>
      </p>
    </form>
  )
}

function ForgotForm({ go }: { go: (m: Mode) => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setErr(''); setInfo('')
        try {
          if (!sentCode) {
            const c = await requestResetCode(email)
            setSentCode(c)
            setInfo(`重置码已发送。(演示模式下直接显示在这里:${c})`)
          } else {
            await resetPassword(email, code, password)
            setInfo('密码已更新 —— 现在可以登录了。')
            setTimeout(() => go('login'), 1200)
          }
        } catch (ex: any) { setErr(ex.message ?? '重置失败') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">重置密码</h2>
      <p className="text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        输入邮箱以获取重置码。在这个本地演示里,「邮件」会直接显示出来;真正的后端会安全地送达。
      </p>
      <input className={inputCls} placeholder="邮箱" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!sentCode} />
      {sentCode && (
        <>
          <input className={inputCls} placeholder="6 位验证码" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input className={inputCls} placeholder="新密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      )}
      {info && <p className="text-[12.5px]" style={{ color: 'var(--c-accent-2)' }}>{info}</p>}
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? '处理中…' : sentCode ? '设置新密码' : '发送重置码'}
      </button>
      <p className="pt-1 text-center text-[12.5px]">
        <button type="button" className="underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-dim)' }} onClick={() => go('login')}>
          返回登录
        </button>
      </p>
    </form>
  )
}
