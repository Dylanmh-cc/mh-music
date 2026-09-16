import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSettingsStore, DEFAULT_LYRICS, PARTICLE_COLOR_LABELS, BG_MODE_LABELS, VISUALIZER_MODE_LABELS, PERF_MODE_LABELS } from '../../stores/settings'
import { useAuthStore } from '../../stores/auth'
import { useUiStore, toast, askConfirm } from '../../stores/ui'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'
import { changePassword, REMOTE_AUTH } from '../../services/auth'
import {
  startLogin, pollLogin, fetchPlaylists, importPlaylist,
  getSession, signOut, isConfigured, status, type NeteasePlaylist,
} from '../../services/netease'
import { pushPath } from '../../app/router'
import { cn } from '../../lib/format'
import type { BgMode, LyricsSettings, ParticleColor, ParticleDensity, ThemeMode, PerfMode } from '../../types/models'
import { IconCheck } from '../icons'
import { PlayModeButtons } from '../player/PlayModeButtons'
import { clearLyricCache } from '../../lib/onlineLyrics'
import { buildLyricBackup, readLyricBackup } from '../../lib/lyricBackup'
import { lyricsToLines } from '../../lib/lrc'

/** Theme ids, spelled the way the picker above spells them. */
const THEME_LABELS: Record<ThemeMode, string> = {
  dynamic: '动态',
  dark: '暗色',
  black: '纯黑',
  midnight: '午夜',
  glass: '玻璃',
  aurora: '极光',
  sunset: '日落',
}

export function SettingsView() {
  return (
    <div className="mx-auto max-w-[760px] pb-10">
      <h1 className="mb-2 mt-4 text-[26px] font-bold tracking-tight">设置</h1>
      <p className="mb-8 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>所有设置都保存在你的账户下(按浏览器)。</p>
      <AppearanceSection />
      <AnimationSection />
      <AlbumSection />
      <LyricsSection />
      <LyricSourceSection />
      <PlaybackSection />
      <AudioSection />
      <VisualsSection />
      <LibrarySection />
      <NeteaseSection />
      <ImportExportSection />
      <AccountSection />
      <PrivacySection />
      <ShortcutsSection />
      <AboutSection />
    </div>
  )
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="glass-soft mb-4 rounded-3xl p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-[14px]">{label}</div>
        {hint && <div className="mt-1 text-[12px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[30px] w-[54px] rounded-full transition-colors duration-300"
      style={{
        background: on ? 'var(--c-accent)' : 'rgba(255,255,255,0.12)',
        boxShadow: on ? '0 0 16px var(--c-glow-soft)' : 'none',
      }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow"
        style={{ left: on ? 27 : 3 }}
      />
    </button>
  )
}

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; ariaLabel: string
}) {
  return (
    <div className="glass-soft flex max-w-full overflow-x-auto rounded-full p-0.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] transition-colors', value === o.value ? 'font-medium text-[var(--c-ink)]' : 'text-[var(--c-ink-faint)] hover:text-white')}
        >
          {value === o.value && <motion.span layoutId={`seg-${ariaLabel}`} className="absolute inset-0 rounded-full bg-white/12" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function Slider({ value, min, max, step, onChange, label, format }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; format?: (v: number) => string
}) {
  return (
    <div className="flex w-full items-center gap-3 sm:w-[248px]">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
        style={{ ['--fill' as any]: `${((value - min) / (max - min)) * 100}%` }}
        aria-label={label}
      />
      <span className="w-12 text-right text-[12px] tabular-nums" style={{ color: 'var(--c-ink-dim)' }}>
        {format ? format(value) : value}
      </span>
    </div>
  )
}

function AccountSection() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')

  return (
    <Card title="账户" hint={`已登录为 ${user?.name}(${user?.email})`}>
      <div className="flex items-center gap-2">
        <input type="password" placeholder="当前密码" value={cur} onChange={(e) => setCur(e.target.value)} className="w-full min-w-[150px] flex-1 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25 sm:w-[150px] sm:flex-none" aria-label="当前密码" />
        <input type="password" placeholder="新密码" value={next} onChange={(e) => setNext(e.target.value)} className="w-full min-w-[150px] flex-1 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25 sm:w-[150px] sm:flex-none" aria-label="新密码" />
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={async () => {
            setMsg('')
            try {
              await changePassword(user!.id, cur, next)
              setMsg('密码已更新。')
              setCur(''); setNext('')
            } catch (e: any) { setMsg(e.message) }
          }}
        >
          更新
        </button>
        {msg && <span className="text-[11.5px]" style={{ color: 'var(--c-accent-2)' }}>{msg}</span>}
      </div>
      <Row label="退出这台设备的登录">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={logout}>退出登录</button>
      </Row>
    </Card>
  )
}

function AppearanceSection() {
  const s = useSettingsStore()
  return (
    <Card title="外观">
      <Row label="主题" hint="动态配色跟随当前专辑的封面">
        <Segmented<ThemeMode>
          ariaLabel="theme"
          value={s.settings.theme}
          onChange={(v) => { s.setSetting('theme', v); if (v !== 'dynamic') s.setSetting('dynamicColors', false); else s.setSetting('dynamicColors', true) }}
          options={[
            { value: 'dynamic', label: '动态' },
            { value: 'dark', label: '暗色' },
            { value: 'black', label: '纯黑' },
            { value: 'midnight', label: '午夜' },
            { value: 'glass', label: '玻璃' },
          ]}
        />
      </Row>
      <Row label="动态专辑配色" hint="用每张专辑的色板重新绘制环境">
        <Toggle on={s.settings.dynamicColors} onChange={(v) => s.setSetting('dynamicColors', v)} label="动态专辑配色" />
      </Row>
      <Row label="音乐地貌" hint="播放页会从曲目中升起方块地形 —— 这是唯一的可视化效果,配色始终取自当前专辑。">
        <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>方块地形 · 已开启</span>
      </Row>
      <Row label="地貌配色" hint="随机:每个方块各自散色;专辑封面:全部取自当前封面。">
        <Segmented<ParticleColor>
          ariaLabel="地貌配色"
          value={s.settings.particleColor}
          onChange={(v) => s.setSetting('particleColor', v)}
          options={PARTICLE_COLOR_LABELS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </Row>
      <Row label="播放模式" hint="顺序、随机与单曲循环三者互斥">
        <PlayModeButtons size={32} />
      </Row>
    </Card>
  )
}

/** Album presentation: the 3D layout defaults plus where to tune them. */
function AlbumSection() {
  const s = useSettingsStore()
  const g = s.settings.layouts.global
  const albumCount = useLibraryStore((st) => st.albums.length)
  return (
    <Card title="专辑" hint="位置、旋转、缩放、深度、阴影与倒影 —— 可全局,也可单张专辑。">
      <Row label="卡片缩放" hint="应用到每个 3D 专辑封套的全局倍率">
        <Slider
          label="专辑缩放" value={g.scale} min={0.7} max={1.4} step={0.01}
          onChange={(v) => s.setLayoutGlobal({ scale: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </Row>
      <Row label="阴影深度" hint="封套浮在墙面上方的高度">
        <Slider
          label="专辑阴影" value={g.shadow} min={0} max={1.2} step={0.05}
          onChange={(v) => s.setLayoutGlobal({ shadow: v })}
          format={(v) => v.toFixed(2)}
        />
      </Row>
      <Row label="地面倒影" hint="卡片下方镜像的封套虚影">
        <Slider
          label="专辑倒影" value={g.reflection} min={0} max={1} step={0.05}
          onChange={(v) => s.setLayoutGlobal({ reflection: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Row>
      <Row label="单独调整某张专辑" hint={`音乐库中共 ${albumCount} 张专辑`}>
        <div className="flex gap-2">
          <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => useUiStore.getState().navigate('albums')}>打开专辑墙</button>
          <button
            className="lg-btn px-4 py-2 text-[12.5px]"
            onClick={() => { s.resetLayout(); toast('info', '专辑布局已重置。') }}
          >
            重置为全局
          </button>
        </div>
      </Row>
    </Card>
  )
}

function AnimationSection() {
  const s = useSettingsStore()
  return (
    <Card title="动画">
      <Row label="界面动画" hint="环境漂浮、倾斜、呼吸与悬停模糊。关闭后所有舞台效果也会平静下来;系统「减少动态效果」的偏好始终会被尊重。">
        <Toggle on={s.settings.animations} onChange={(v) => s.setSetting('animations', v)} label="动画" />
      </Row>
      <Row label="动态背景" hint="星空、分子网络、鼓点涟漪与低频光带">
        <Toggle on={s.settings.ambientStage} onChange={(v) => s.setSetting('ambientStage', v)} label="环境舞台" />
      </Row>
      <Row label="街头质感" hint="房间里的半调喷绘、模板印记与胶带边缘">
        <Toggle on={s.settings.streetTexture} onChange={(v) => s.setSetting('streetTexture', v)} label="街头质感" />
      </Row>
      <Row label="跳过入场动画" hint="在这台设备上跳过唱片机开场">
        <Toggle on={s.settings.skipIntro} onChange={(v) => s.setSetting('skipIntro', v)} label="跳过入场" />
      </Row>
      <Row label="重新播放入场动画" hint="再次播放唱片机开场动画">
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => {
            useUiStore.getState().setIntroDone(false)
            useUiStore.getState().navigate('home')
          }}
        >
          重新播放入场动画
        </button>
      </Row>
    </Card>
  )
}

function LyricsSection() {
  const s = useSettingsStore()
  const L = s.settings.lyrics
  const set = s.setLyric
  return (
    <Card title="歌词" hint="歌词随音乐流动 —— 在这里调整它的存在感。">
      <Row label="字号">
        <Slider label="歌词字号" value={L.size} min={13} max={34} step={1} onChange={(v) => set('size', v)} format={(v) => `${v}px`} />
      </Row>
      <Row label="不透明度">
        <Slider label="歌词不透明度" value={L.opacity} min={0.3} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="显示行数">
        <Segmented<string> ariaLabel="歌词行数" value={String(L.lines)} onChange={(v) => set('lines', parseInt(v, 10))} options={[1, 3, 5, 7].map((n) => ({ value: String(n), label: String(n) }))} />
      </Row>
      <Row label="在空间中的位置" hint="歌词列相对于唱片的位置">
        <Segmented<LyricsSettings['side']> ariaLabel="歌词位置" value={L.side} onChange={(v) => set('side', v)} options={[{ value: 'left', label: '靠左' }, { value: 'center', label: '居中' }, { value: 'right', label: '靠右' }]} />
      </Row>
      <Row label="行切换" hint="一行让位给下一行的方式">
        <Segmented<LyricsSettings['motion']> ariaLabel="歌词动效" value={L.motion} onChange={(v) => set('motion', v)} options={[{ value: 'fade', label: '淡入淡出' }, { value: 'slide', label: '滑动' }, { value: 'blur', label: '模糊' }, { value: 'scale', label: '缩放' }]} />
      </Row>
      <Row label="翻译" hint="当歌词文件带有翻译时,在当前行下方显示译文">
        <Toggle on={L.translation} onChange={(v) => set('translation', v)} label="歌词翻译" />
      </Row>
      <Row label="下一行" hint="关闭后窗口里只保留正在唱的这一行">
        <Toggle on={L.showNext} onChange={(v) => set('showNext', v)} label="显示下一行" />
      </Row>
      <Row label="位置">
        <Segmented<LyricsSettings['mode']> ariaLabel="歌词模式" value={L.mode} onChange={(v) => set('mode', v)} options={[{ value: 'floating', label: '浮动' }, { value: 'centered', label: '居中' }, { value: 'bottom', label: '底部' }]} />
      </Row>
      <Row label="对齐方式">
        <Segmented<LyricsSettings['align']> ariaLabel="歌词对齐" value={L.align} onChange={(v) => set('align', v)} options={[{ value: 'left', label: '靠左' }, { value: 'center', label: '居中' }, { value: 'right', label: '靠右' }]} />
      </Row>
      <Row label="行间距">
        <Slider label="歌词行距" value={L.gap} min={4} max={40} step={1} onChange={(v) => set('gap', v)} format={(v) => `${v}px`} />
      </Row>
      <Row label="动画速度">
        <Slider label="歌词速度" value={L.speed} min={0.5} max={2} step={0.1} onChange={(v) => set('speed', v)} format={(v) => `${v.toFixed(1)}×`} />
      </Row>
      <Row label="歌词动画" hint="随演唱逐字扫过整行填充">
        <Toggle on={L.animate} onChange={(v) => set('animate', v)} label="歌词动画" />
      </Row>
      <Row label="高亮颜色">
        <div className="flex items-center gap-2">
          {['#ffffff', 'var(--c-accent-2)', 'var(--c-accent)', '#ffd166', '#ff9ad5', '#9dffb0'].map((c) => (
            <button
              key={c}
              aria-label={`高亮色 ${c}`}
              onClick={() => set('highlight', c)}
              className="grid h-6 w-6 place-items-center rounded-full border border-white/20"
              style={{ background: c.startsWith('var') ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#fff' : c }}
            >
              {L.highlight === c && <IconCheck size={12} style={{ color: '#111' }} />}
            </button>
          ))}
        </div>
      </Row>
      <Row label="重置歌词设置">
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => { (Object.keys(DEFAULT_LYRICS) as Array<keyof LyricsSettings>).forEach((k) => set(k, DEFAULT_LYRICS[k])); toast('info', '歌词设置已恢复。') }}
        >
          重置歌词设置
        </button>
      </Row>
    </Card>
  )
}

/**
 * Where lyric text comes from for tracks that ship without any.
 *
 * The lookup runs on the server, never in the page: the public lyric APIs answer
 * without CORS headers, so the browser cannot read them. A proxy ships with the
 * project (`netlify/functions/lyrics.mjs` on Netlify, `server/auth-server.mjs`
 * when self-hosted) and both use the provider chain of the lyricFlow utility.
 */
function LyricSourceSection() {
  const s = useSettingsStore()
  const lib = useLibraryStore()
  const src = s.settings.lyricSource
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; found: number } | null>(null)
  const lyricsInput = useRef<HTMLInputElement | null>(null)
  const withLyrics = lib.songs.some((x) => x.lrc?.length)
  const missing = lib.songs.filter((x) => !x.lrc?.length).length

  const exportLyrics = () => {
    const { blob, count } = buildLyricBackup(useLibraryStore.getState().songs)
    if (!count) { toast('info', '还没有可导出的歌词。'); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mh-music-lyrics-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('success', `已导出 ${count} 首曲目的歌词。`)
  }

  const fill = async () => {
    setBusy(true)
    setProgress({ done: 0, total: missing, found: 0 })
    try {
      const res = await lib.fetchMissingLyrics(setProgress)
      if (!res.total) toast('info', '音乐库里所有曲目都已有歌词。')
      else if (!res.found) toast('error', '没有找到歌词 —— 请确认部署里带有 /api/lyrics 代理(见 DEPLOY.md)。')
      else toast('success', `已为 ${res.found} / ${res.total} 首曲目添加歌词。`)
    } catch {
      toast('error', '获取歌词时出错。')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Card title="歌词来源" hint="为没有自带歌词的曲目在线查找歌词。查找通过服务端代理完成,浏览器无法直接访问这些接口。">
      <Row label="自动获取" hint="导入曲目时在后台补齐缺失的歌词">
        <Toggle on={src.autoFetch} onChange={(v) => { s.setSetting('lyricSource', { ...src, autoFetch: v }); clearLyricCache() }} label="自动获取歌词" />
      </Row>
      <Row label="歌词接口" hint="默认使用本站自带的 /api/lyrics;也可以填你自己服务器的完整地址">
        <input
          value={src.endpoint}
          onChange={(e) => { s.setSetting('lyricSource', { ...src, endpoint: e.target.value.trim() }); clearLyricCache() }}
          placeholder="/api/lyrics"
          className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
          aria-label="歌词接口地址"
        />
      </Row>
      <Row label="优先数据源" hint="LrcApi 为默认;TuneHub 聚合网易云/Kuwo/QQ,可作补充">
        <Segmented<'lrcapi' | 'tunehub'>
          ariaLabel="歌词数据源"
          value={src.provider}
          onChange={(v) => { s.setSetting('lyricSource', { ...src, provider: v }); clearLyricCache() }}
          options={[
            { value: 'lrcapi', label: 'LrcApi' },
            { value: 'tunehub', label: 'TuneHub' },
          ]}
        />
      </Row>
      <Row label="补齐整库歌词" hint={missing ? `还有 ${missing} 首曲目没有歌词` : '所有曲目都已有歌词'}>
        <div className="flex items-center gap-3">
          {progress && (
            <span className="text-[12px] tabular-nums" style={{ color: 'var(--c-ink-dim)' }}>
              {progress.done}/{progress.total} · 已找到 {progress.found}
            </span>
          )}
          <button className="lg-btn px-4 py-2 text-[12.5px]" disabled={busy || !missing} onClick={() => void fill()}>
            {busy ? '查找中…' : '开始补齐'}
          </button>
        </div>
      </Row>
      <Row label="本地音乐文件夹" hint="歌词也可以由 lyricFlow 这类工具写成本地 .lrc 文件,重新扫描文件夹即可读入(并会读取文件内嵌歌词)">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => useUiStore.getState().navigate('folders')}>
          打开文件夹
        </button>
      </Row>
      <Row label="备份与恢复" hint="歌词保存在这个浏览器里;导出备份后,换设备或清了站点数据也能按 歌名+歌手 还原">
        <div className="flex gap-2">
          <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={exportLyrics} disabled={!withLyrics}>
            导出歌词
          </button>
          <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => lyricsInput.current?.click()}>
            恢复歌词
          </button>
        </div>
        <input
          ref={lyricsInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              const res = await readLyricBackup(file, useLibraryStore.getState().songs)
              if (res.matched.size) {
                useLibraryStore.setState((st) => ({
                  songs: st.songs.map((x) => {
                    const text = res.matched.get(x.id)
                    if (!text) return x
                    const lrc = lyricsToLines(text)
                    return lrc?.length ? { ...x, lrc } : x
                  }),
                }))
                // one write for the whole restore
                useLibraryStore.getState().persistNow()
              }
              const parts = [`恢复 ${res.restored} 首`]
              if (res.skipped) parts.push(`跳过 ${res.skipped} 首(已有歌词或内容为空)`)
              if (res.unmatched.length) parts.push(`${res.unmatched.length} 首在库中找不到`)
              toast(res.restored ? 'success' : 'info', `${parts.join(',')}。`)
            } catch (err: any) {
              toast('error', err?.message ?? '无法读取这个备份文件。')
            }
          }}
          aria-hidden="true"
        />
      </Row>
    </Card>
  )
}

function PlaybackSection() {
  const s = useSettingsStore()
  const player = usePlayerStore()
  return (
    <Card title="播放">
      <Row label="默认音量" hint="载入时应用,并在会话之间记住">
        <Slider label="音量" value={s.settings.volume} min={0} max={1} step={0.01} onChange={(v) => player.setVolume(v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="交叉淡入淡出" hint="切歌时压低正在结束的曲目,并淡入下一首">
        <Slider label="Crossfade" value={s.settings.crossfade} min={0} max={6} step={0.5} onChange={(v) => s.setSetting('crossfade', v)} format={(v) => (v === 0 ? '关闭' : `${v.toFixed(1)}s`)} />
      </Row>
      <Row label="音量渐入" hint="曲目开始时让音量平滑爬升">
        <Toggle on={s.settings.smoothVolume} onChange={(v) => s.setSetting('smoothVolume', v)} label="音量渐入" />
      </Row>
    </Card>
  )
}

/** Visuals — the visualiser preset plus how hard the music drives it. */
function VisualsSection() {
  const s = useSettingsStore()
  const v = s.settings.visual
  const set = s.setVisual

  return (
    <Card title="视觉效果" hint="音乐空间长什么样,以及它回应曲目的强度。">
      <Row label="可视化模式" hint={VISUALIZER_MODE_LABELS.find((m) => m.id === s.settings.visualizerMode)?.hint}>
        <div className="flex max-w-[420px] flex-wrap justify-end gap-1.5">
          {VISUALIZER_MODE_LABELS.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={s.settings.visualizerMode === m.id}
              onClick={() => s.setSetting('visualizerMode', m.id)}
              className="rounded-full px-3 py-1.5 text-[12px] transition-colors duration-200"
              style={{
                background: s.settings.visualizerMode === m.id ? 'var(--c-tint)' : 'rgba(255,255,255,0.05)',
                color: s.settings.visualizerMode === m.id ? 'var(--c-accent-2)' : 'var(--c-ink-faint)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="可视化配色" hint="专辑:取自当前封面;随机:每个元素各自取色。">
        <Segmented<ParticleColor>
          ariaLabel="可视化配色"
          value={s.settings.particleColor}
          onChange={(val) => s.setSetting('particleColor', val)}
          options={PARTICLE_COLOR_LABELS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </Row>
      <Row label="播放器背景" hint={BG_MODE_LABELS.find((b) => b.id === s.settings.bgMode)?.hint}>
        <Segmented<BgMode>
          ariaLabel="播放器背景"
          value={s.settings.bgMode}
          onChange={(val) => s.setBgMode(val)}
          options={BG_MODE_LABELS.map((b) => ({ value: b.id, label: b.label }))}
        />
      </Row>
      <Row label="细节" hint="可视化效果的分辨率;越高越需要更强的显卡">
        <Segmented<ParticleDensity>
          ariaLabel="可视化细节"
          value={v.density}
          onChange={(val) => set('density', val)}
          options={[{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'ultra', label: '极高' }]}
        />
      </Row>
      <Row label="性能模式" hint={PERF_MODE_LABELS.find((p) => p.id === v.perf)?.hint}>
        <Segmented<PerfMode>
          ariaLabel="性能模式"
          value={v.perf}
          onChange={(val) => set('perf', val)}
          options={PERF_MODE_LABELS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </Row>
      <Row label="音乐灵敏度" hint="分析器推动视觉效果的强度">
        <Slider label="音乐灵敏度" value={v.sensitivity} min={0} max={1} step={0.05} onChange={(val) => set('sensitivity', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="鼓点灵敏度" hint="鼓点被识别为节拍的难易程度">
        <Slider label="鼓点灵敏度" value={v.beatResponse} min={0} max={1} step={0.05} onChange={(val) => set('beatResponse', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="唱片尺寸" hint="封套与唱片一起缩放,始终匹配">
        <Slider label="唱片尺寸" value={v.vinylSize} min={0.5} max={2} step={0.05} onChange={(val) => set('vinylSize', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="背景不透明度" hint="房间透过可视化效果显示的程度">
        <Slider label="背景不透明度" value={v.bgOpacity} min={0} max={1} step={0.05} onChange={(val) => set('bgOpacity', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="玻璃模糊" hint="控制台、面板与播放器上液态玻璃的模糊程度">
        <Slider label="玻璃模糊" value={v.glassBlur} min={0} max={1} step={0.05} onChange={(val) => set('glassBlur', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
    </Card>
  )
}

/** Library & data — everything a user can add is also removable here. */
function LibrarySection() {
  const lib = useLibraryStore()
  const reset = useSettingsStore((s) => s.resetSettings)
  const navigate = useUiStore((s) => s.navigate)
  const demo = lib.demoCount()
  return (
    <Card title="音乐库" hint="管理音乐库背后的文件夹、历史与数据。">
      <Row label="音乐文件夹" hint={`已链接 ${lib.folders.length} 个 · 音乐库共 ${lib.songs.length} 首`}>
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => navigate('folders')}>管理文件夹</button>
      </Row>
      <Row
        label="示例音乐"
        hint={demo ? `${demo} 首示例曲目作为预览混在音乐库中` : '音乐库里没有示例曲目'}
      >
        <button
          className="lg-btn px-4 py-2 text-[12.5px] text-[#ff9a8a] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!demo}
          onClick={() => askConfirm({
            title: '清除示例音乐?',
            body: `${demo} 首示例曲目将从音乐库中移除,同时移除它们所在的专辑和相关收藏。你自己添加的音乐不受影响。`,
            confirmLabel: '清除示例数据',
            danger: true,
            onConfirm: () => lib.clearDemo(),
          })}
        >
          清除示例数据
        </button>
      </Row>
      <Row label="播放历史" hint={`已记录 ${lib.history.length} 次播放`}>
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => askConfirm({
            title: '清除播放历史?',
            body: '「最近播放」将被清空。音乐库与歌单不受影响。',
            confirmLabel: '清除历史',
            danger: true,
            onConfirm: () => { lib.clearHistory(); toast('info', '播放历史已清除。') },
          })}
        >
          清除播放历史
        </button>
      </Row>
      <Row label="重置全部设置" hint="主题、歌词、动画 —— 全部回到初始状态,音乐库保留。">
        <button
          className="lg-btn px-4 py-2 text-[12.5px] text-[#ff9a8a]"
          onClick={() => askConfirm({
            title: '把所有设置恢复为默认?',
            body: '外观、动画、歌词与专辑布局都会恢复为默认值。你的音乐库、收藏与歌单都会保留。',
            confirmLabel: '重置设置',
            danger: true,
            onConfirm: () => { reset(); toast('info', '设置已重置。') },
          })}
        >
          重置设置
        </button>
      </Row>
    </Card>
  )
}

function ShortcutsSection() {
  const rows: Array<[string, string]> = [
    ['空格', '播放 / 暂停'],
    ['← / →', '快退 / 快进 ±5 秒'],
    ['Shift + ← / →', '上一首 / 下一首'],
    ['↑ / ↓', '音量'],
    ['M', '静音'],
    ['S', '随机播放'],
    ['R', '循环模式'],
    ['F', '收藏当前歌曲'],
    ['L', '打开歌词空间'],
    ['V', '打开可视化效果'],
    ['/', '搜索'],
    ['Esc', '关闭浮层 / 退出 3D 空间'],
  ]
  return (
    <Card title="键盘快捷键">
      <div className="grid gap-1 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-white/4">
            <span className="text-[12.5px]" style={{ color: 'var(--c-ink-dim)' }}>{v}</span>
            <kbd className="glass-soft rounded-lg px-2 py-0.5 text-[11px]">{k}</kbd>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Audio — the engine itself: fade, level, and what happens between tracks. */
function AudioSection() {
  const s = useSettingsStore()
  const player = usePlayerStore()
  return (
    <Card title="音频" hint="引擎。播放永远优先于屏幕上绘制的一切。">
      <Row label="输出音量" hint="与底部控制条调节的是同一音量">
        <Slider label="音量" value={s.settings.volume} min={0} max={1} step={0.01} onChange={(v) => player.setVolume(v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="静音">
        <Toggle on={player.muted} onChange={() => player.toggleMute()} label="静音" />
      </Row>
      <Row label="交叉淡入淡出" hint="一首曲目让位给下一首所需的时间">
        <Slider label="Crossfade" value={s.settings.crossfade} min={0} max={6} step={0.5} onChange={(v) => s.setSetting('crossfade', v)} format={(v) => (v ? `${v.toFixed(1)}s` : '关闭')} />
      </Row>
      <Row label="平滑音量" hint="音量变化时渐变,而不是直接跳变">
        <Toggle on={s.settings.smoothVolume} onChange={(v) => s.setSetting('smoothVolume', v)} label="平滑音量" />
      </Row>
      <Row label="正在播放" hint="曲目、进度与队列状态在所有页面之间共享">
        <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          {player.songId ? '引擎运行中' : '空闲 · 未载入曲目'}
        </span>
      </Row>
    </Card>
  )
}

/** Import / Export — the library in and out, in open formats. */
function ImportExportSection() {
  const lib = useLibraryStore()
  const navigate = useUiStore((s) => s.navigate)
  const [busy, setBusy] = useState(false)

  const exportJson = async () => {
    setBusy(true)
    try {
      const payload = {
        app: 'MH Music',
        version: 1,
        exportedAt: new Date().toISOString(),
        albums: lib.albums.map((a) => ({ name: a.name, artist: a.artist, year: a.year, tracks: a.songIds.map((id) => lib.getSong(id)?.title).filter(Boolean) })),
        favorites: lib.favorites.songs.map((id) => lib.getSong(id)?.title).filter(Boolean),
        playlists: lib.playlists.map((p) => ({ name: p.name, tracks: p.songIds.map((id) => lib.getSong(id)?.title).filter(Boolean) })),
        history: lib.history.slice(-200).map((h) => ({ title: lib.getSong(h.songId)?.title, at: h.at })).filter((h) => h.title),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mh-music-library-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('success', '音乐库已导出为 JSON。')
    } catch {
      toast('error', '导出写入失败。')
    } finally {
      setBusy(false)
    }
  }

  const exportM3U = () => {
    const lines = ['#EXTM3U', '#PLAYLIST:MH Music — favorites']
    for (const id of lib.favorites.songs) {
      const s = lib.getSong(id)
      if (!s) continue
      lines.push(`#EXTINF:${Math.round(s.duration)},${s.artist} - ${s.title}`)
      lines.push(s.path ?? s.title)
    }
    const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mh-music-favorites.m3u8'
    a.click()
    URL.revokeObjectURL(url)
    toast('success', '收藏已导出为 M3U8。')
  }

  return (
    <Card title="导入 / 导出" hint="无需中间服务器,即可导入导出你的音乐库。">
      <Row label="导入歌单" hint="JSON · M3U · M3U8 · CSV,与本地文件匹配">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => { navigate('import'); pushPath('/import') }}>
          打开导入器
        </button>
      </Row>
      <Row label="导出音乐库" hint="专辑、收藏、歌单与历史合并为一个 JSON 文件">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => void exportJson()} disabled={busy}>
          {busy ? '导出中…' : '导出 JSON'}
        </button>
      </Row>
      <Row label="导出收藏" hint="标准的 M3U8,任何播放器都能读取">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={exportM3U}>导出 M3U8</button>
      </Row>
      <Row label="添加音乐" hint="文件夹在浏览器中读取,不会上传任何内容">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => { navigate('folders'); pushPath('/folders') }}>
          管理文件夹
        </button>
      </Row>
    </Card>
  )
}

/** Privacy — what is stored, where, and what never leaves the device. */
function PrivacySection() {
  return (
    <Card title="隐私" hint="MH Music 保存了什么,保存在哪里。">
      <div className="space-y-2.5 px-1 pb-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
        <p><strong style={{ color: 'var(--c-ink)' }}>音频从不离开你的设备。</strong> 文件夹通过 File System Access API 读取(不支持时使用文件选择器),在本地解码,并从 blob URL 播放。整个应用没有任何上传步骤。</p>
        {REMOTE_AUTH ? (
          <p><strong style={{ color: 'var(--c-ink)' }}>你的账户保存在服务器上。</strong> 昵称、邮箱、带独立盐值的 scrypt 密码哈希(绝不是明文密码)以及会话令牌都存在账户服务器上,所以登录一次即可在任何浏览器使用。而你的音乐文件、音乐库、收藏与歌单仍然只留在这个浏览器里。</p>
        ) : (
          <p><strong style={{ color: 'var(--c-ink)' }}>你的账户保存在本地。</strong> 密码只以 PBKDF2-SHA256 加独立盐值的哈希保存 —— 绝不保存明文。认证模块基于一层很小的适配器接口编写,因此真正的后端可以直接替换它,而不需要改动界面。</p>
        )}
        <p><strong style={{ color: 'var(--c-ink)' }}>每个账户彼此隔离。</strong> 音乐库、收藏、歌单、历史、设置、歌词与布局偏好都按用户分命名空间存放;换成别人登录,看不到其中任何内容。</p>
        <p><strong style={{ color: 'var(--c-ink)' }}>删除是明确的操作。</strong> 移除曲目只是把它从音乐库中移出。删除原始文件始终是另一次独立的二次确认。</p>
      </div>
    </Card>
  )
}

/** NetEase Cloud Music — the connection, and what it can honestly do. */
function NeteaseSection() {
  const s = useSettingsStore()
  const cfg = s.settings.netease
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState<{ key: string; qrImage: string } | null>(null)
  const [playlists, setPlaylists] = useState<NeteasePlaylist[] | null>(null)
  const poll = useRef<number>(0)

  const set = (patch: Partial<typeof cfg>) => s.setSetting('netease', { ...cfg, ...patch })

  const connect = async () => {
    setBusy(true)
    try {
      const out = await startLogin()
      // the SDK strategy hands the whole sign-in to NetEase and comes back
      // signed in; the backend strategy gives us a code to display and poll
      if (!out) {
        set({ enabled: true })
        setPlaylists(await fetchPlaylists())
        toast('success', '已连接网易云音乐。')
        return
      }
      setQr(out)
      window.clearInterval(poll.current)
      poll.current = window.setInterval(async () => {
        try {
          const st = await pollLogin(out.key)
          if (st.code === 803) {
            window.clearInterval(poll.current)
            setQr(null)
            set({ enabled: true })
            toast('success', '已连接网易云音乐。')
            setPlaylists(await fetchPlaylists())
          } else if (st.code === 800) {
            window.clearInterval(poll.current)
            setQr(null)
            toast('error', '二维码已过期,请重试。')
          }
        } catch {
          window.clearInterval(poll.current)
          setQr(null)
        }
      }, 2000)
    } catch (e) {
      toast('error', e instanceof Error && e.message === 'unconfigured'
        ? '请先填写后端地址。'
        : '无法连接到该服务。')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => () => window.clearInterval(poll.current), [])

  const importOne = async (pl: NeteasePlaylist) => {
    try {
      const res = await importPlaylist(pl)
      toast('success', `「${pl.name}」已导入 —— ${res.matched + res.missing} 首中匹配到 ${res.matched} 首。`)
    } catch {
      toast('error', `「${pl.name}」导入失败。`)
    }
  }

  return (
    <Card title="网易云音乐" hint="通过你自己的后端接入 —— 绝不在浏览器里放密钥。">
      <Row label="接入方式" hint="官方文档提供了两种方式:面向网页的浏览器 SDK,以及密钥留在你自己服务器上的 REST 接口。">
        <Segmented<'none' | 'jssdk' | 'backend'>
          ariaLabel="网易云接入方式"
          value={cfg.strategy}
          onChange={(v) => set({ strategy: v })}
          options={[
            { value: 'none', label: '关闭' },
            { value: 'jssdk', label: '网页 SDK' },
            { value: 'backend', label: '我的服务器' },
          ]}
        />
      </Row>
      {cfg.strategy === 'jssdk' && (
        <Row label="SDK 脚本地址" hint="来自开放平台文档中心(网页应用接入)的浏览器 SDK,登录过程在网易云的域名下完成。">
          <input
            value={cfg.sdkUrl}
            onChange={(e) => set({ sdkUrl: e.target.value })}
            placeholder="https://…/netease-music-sdk.js"
            className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
            aria-label="网易云 SDK 脚本地址"
          />
        </Row>
      )}
      <Row label="App ID" hint="开放平台控制台里的公开标识,放在这里没有风险。">
        <input
          value={cfg.appId}
          onChange={(e) => set({ appId: e.target.value })}
          placeholder="b3010d…"
          className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
          aria-label="网易云 App ID"
        />
      </Row>
      <Row label="后端地址" hint="你自己的服务器,持有 AppSecret 与私钥,并为每次请求签名。">
        <input
          value={cfg.endpoint}
          onChange={(e) => set({ endpoint: e.target.value })}
          placeholder="https://your-server.example/music"
          className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
          aria-label="网易云后端地址"
        />
      </Row>

      <Row label="状态">
        <div className="flex items-center gap-2">
          <span className="mh-mono text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>
            {status() === 'unconfigured' ? '未设置后端地址'
              : status() === 'offline' ? '已配置,未登录'
                : status() === 'ready' ? '后端可达,可以扫码'
                  : '已登录'}
          </span>
          {getSession()
            ? <button className="lg-btn px-3.5 py-1.5 text-[12px]" onClick={() => { signOut(); set({ enabled: false }); setPlaylists(null); toast('info', '已退出网易云。') }}>退出登录</button>
            : <button className="lg-btn lg-btn-primary px-3.5 py-1.5 text-[12px]" disabled={busy || !isConfigured(cfg)} onClick={() => void connect()}>{busy ? '启动中…' : '连接'}</button>}
        </div>
      </Row>

      {qr && (
        <Row label="扫码登录" hint="在手机上打开网易云音乐,扫描这个二维码。">
          <img src={qr.qrImage} alt="网易云登录二维码" className="h-[132px] w-[132px] rounded-xl bg-white p-1.5" />
        </Row>
      )}

      {playlists && (
        <Row label="我的网易云歌单" hint="导入会保留名称与封面;曲目会与你的本地文件匹配。">
          <div className="max-h-[220px] w-[420px] space-y-1 overflow-y-auto pr-1">
            {playlists.length === 0 && <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>该账户没有歌单。</span>}
            {playlists.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {p.coverUrl
                  ? <img src={p.coverUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  : <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'var(--c-tint)' }}>{p.name.slice(0, 1)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]">{p.name}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{p.trackCount ?? '?'} 首</span>
                </span>
                <button className="lg-btn px-3 py-1.5 text-[11.5px]" onClick={() => void importOne(p)}>导入</button>
              </div>
            ))}
          </div>
        </Row>
      )}

      <div className="px-1 pb-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
        为什么需要后端:网易云的每个请求都要用 AppSecret 与 RSA 私钥签名,而这些只应该留在服务器上
        —— 任何打包进浏览器的东西,在页面加载的那一刻就已经公开。所以 MH Music 只保存 AppID 与你的
        后端地址,永远不会接触到密钥。另外,在线播放网易云的音频还需要他们授权的 SDK,不在本项目
        范围之内;这里导入的是歌单本身,这是浏览器能够如实做到的部分。
      </div>
    </Card>
  )
}

/** About — what this is, and what it is built from. */
function AboutSection() {
  const s = useSettingsStore()
  return (
    <Card title="关于 MH Music" hint="Music Beyond Sound.">
      <div className="space-y-3 px-1 pb-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
        <p>
          一台围绕唱片构建的沉浸式播放器:由专辑驱动的配色、开场里真实的 3D 唱片机、
          会回应曲目的可视化效果,以及触手可及的液态玻璃。
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            ['音频', 'Web Audio API · AnalyserNode'],
            ['3D', 'Three.js · WebGL · CSS 3D'],
            ['界面', 'React 18 · TypeScript · Framer Motion'],
            ['存储', 'IndexedDB · 按用户隔离'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{k}</div>
              <div className="mt-0.5 text-[12px]">{v}</div>
            </div>
          ))}
        </div>
        <p className="text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          版本 1.0 · 主题 {THEME_LABELS[s.settings.theme]} · {VISUALIZER_MODE_LABELS.find((m) => m.id === s.settings.visualizerMode)?.label} 可视化 · {PERF_MODE_LABELS.find((p) => p.id === s.settings.visual.perf)?.label} 性能
        </p>
      </div>
    </Card>
  )
}
