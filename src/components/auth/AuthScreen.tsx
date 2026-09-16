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
            A digital vinyl collection. Liquid glass, album-born light,
            and a space that breathes with the music.
          </p>
          <div className="mt-8 flex items-center gap-2 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>
            <IconVinyl size={14} />
            Your library, favorites and playlists stay private to your account.
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
        try { await login(email, password, remember) } catch (ex: any) { setErr(ex.message ?? 'Sign in failed') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">Welcome back</h2>
      <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={inputCls} placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      <div className="flex items-center justify-between text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--c-accent)]" />
          Remember me
        </label>
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => go('forgot')}>
          Forgot password?
        </button>
      </div>
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="pt-1 text-center text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        New here?{' '}
        <button type="button" className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--c-accent-2)' }} onClick={() => go('register')}>
          Create an account
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
        try { await register(name, email, password) } catch (ex: any) { setErr(ex.message ?? 'Registration failed') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">Create your collection</h2>
      <input className={inputCls} placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input className={inputCls} placeholder="Password (min 6 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <p className="pt-1 text-center text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        Already collecting?{' '}
        <button type="button" className="underline-offset-2 hover:underline" style={{ color: 'var(--c-accent-2)' }} onClick={() => go('login')}>
          Sign in
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
            setInfo(`Reset code sent. (Demo mode shows it here: ${c})`)
          } else {
            await resetPassword(email, code, password)
            setInfo('Password updated — you can sign in now.')
            setTimeout(() => go('login'), 1200)
          }
        } catch (ex: any) { setErr(ex.message ?? 'Reset failed') } finally { setBusy(false) }
      }}
      className="space-y-4"
    >
      <h2 className="text-[22px] font-semibold tracking-tight">Reset password</h2>
      <p className="text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>
        Enter your email to receive a reset code. In this local demo the “email” is shown inline; a real backend would deliver it securely.
      </p>
      <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!sentCode} />
      {sentCode && (
        <>
          <input className={inputCls} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input className={inputCls} placeholder="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      )}
      {info && <p className="text-[12.5px]" style={{ color: 'var(--c-accent-2)' }}>{info}</p>}
      {err && <p className="text-[12.5px] text-[#ff9a8a]">{err}</p>}
      <button type="submit" disabled={busy} className="lg-btn lg-btn-primary w-full py-3 text-[14px] font-semibold disabled:opacity-60">
        {busy ? 'Working…' : sentCode ? 'Set new password' : 'Send reset code'}
      </button>
      <p className="pt-1 text-center text-[12.5px]">
        <button type="button" className="underline-offset-2 hover:underline" style={{ color: 'var(--c-ink-dim)' }} onClick={() => go('login')}>
          Back to sign in
        </button>
      </p>
    </form>
  )
}
