import { useEffect, useState } from 'react'
import { useSettingsStore, VISUALIZER_MODE_LABELS, BG_MODE_LABELS, PERF_MODE_LABELS, PARTICLE_COLOR_LABELS } from '../stores/settings'
import { useLibraryStore } from '../stores/library'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { pushPath } from '../app/router'
import { GlassPanel, GlassButton, IconButton } from '../components/glass/GlassPanel'
import { Visualizer } from '../components/player/Visualizer'
import { IconPlay, IconPause, IconNext, IconPrev, IconClose } from '../components/icons'
import { rgba } from '../lib/color'
import { DEFAULT_PALETTE } from '../lib/color'
import type { BgMode, PerfMode, ParticleColor, ParticleDensity, Palette, VisualizerMode } from '../types/models'

/** The small caps tag above each mode card — the mode's own id, in Chinese. */
const MODE_TAGS: Record<VisualizerMode, string> = {
  terrain: '地貌',
  waveform: '波形',
  circular: '环形',
  particles: '粒子',
  vinylWave: '波纹',
  galaxy: '星系',
  aurora: '极光',
  minimal: '极简',
}

/**
 * Visualizer — the studio.
 *
 * A full-bleed canvas running the selected mode over the current album's
 * palette, and below it every control that shapes it: which of the eight modes
 * draws, which room it draws into, where its colours come from, how hard the
 * analysis pushes it, and how much of the device the whole thing is allowed to
 * use. Everything here writes straight to the settings store, so the player
 * and this page can never disagree.
 */
export function VisualizerPage() {
  const lib = useLibraryStore()
  const player = usePlayerStore()
  const s = useSettingsStore()
  const v = s.settings.visual
  const set = s.setVisual

  const song = lib.getSong(player.songId ?? '')
  const album = song ? lib.getAlbum(song.albumId) : undefined
  const palette: Palette = album?.palette ?? DEFAULT_PALETTE

  return (
    <div className="pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3 pl-1">
        <div>
          <h1 className="mh-display text-[30px] md:text-[36px]">可视化效果</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            {album ? `${album.name} — ${album.artist}` : '播放一首即可看到它动起来'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton onClick={() => { useUiStore.getState().toggleNowPlaying(true); pushPath('/player') }}>
            进入播放空间
          </GlassButton>
        </div>
      </header>

      {/* ── the stage ───────────────────────────────────────────────────── */}
      <GlassPanel tier="glass" className="relative mt-5 overflow-hidden rounded-3xl" lit={false}>
        <div
          className="relative w-full overflow-hidden rounded-3xl"
          style={{ aspectRatio: '16 / 8', background: `radial-gradient(120% 90% at 50% 20%, ${palette.deep2}, ${palette.deep} 72%)` }}
        >
          <Visualizer mode={s.settings.visualizerMode} palette={palette} className="absolute inset-0 h-full w-full" />
          {/* a light transport, so the stage can be auditioned without leaving */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
            <div className="glass-soft flex items-center gap-1.5 rounded-full p-1.5">
              <IconButton label="上一首" className="h-9 w-9" onClick={() => player.prev()}><IconPrev size={16} /></IconButton>
              <button
                className="lg-btn lg-btn-primary grid h-11 w-11 place-items-center rounded-full"
                onClick={player.toggle}
                aria-label={player.isPlaying ? '暂停' : '播放'}
              >
                {player.isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
              </button>
              <IconButton label="下一首" className="h-9 w-9" onClick={() => player.next()}><IconNext size={16} /></IconButton>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ── modes ──────────────────────────────────────────────────────── */}
      <section className="mt-7" aria-label="可视化效果模式">
        <h2 className="mh-display mb-3 pl-1 text-[17px]">模式</h2>
        <div className="mh-mode-grid">
          {VISUALIZER_MODE_LABELS.map((m) => (
            <button
              key={m.id}
              className="mh-mode-card"
              data-on={s.settings.visualizerMode === m.id ? 'true' : undefined}
              aria-pressed={s.settings.visualizerMode === m.id}
              onClick={() => s.setSetting('visualizerMode', m.id)}
            >
              <div className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{MODE_TAGS[m.id]}</div>
              <div className="mt-1 text-[14px] font-semibold">{m.label}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{m.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── the room it plays in ───────────────────────────────────────── */}
      <section className="mt-8" aria-label="播放背景">
        <h2 className="mh-display mb-3 pl-1 text-[17px]">背景</h2>
        <div className="mh-mode-grid">
          {BG_MODE_LABELS.map((b) => (
            <button
              key={b.id}
              className="mh-mode-card"
              data-on={s.settings.bgMode === b.id ? 'true' : undefined}
              aria-pressed={s.settings.bgMode === b.id}
              onClick={() => s.setBgMode(b.id as BgMode)}
            >
              <div className="text-[14px] font-semibold">{b.label}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{b.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── how it responds ────────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2" aria-label="响应">
        <GlassPanel tier="soft" className="rounded-3xl p-5">
          <h2 className="mh-display text-[16px]">响应</h2>
          <div className="mt-4 space-y-4">
            <Slider label="音乐灵敏度" value={v.sensitivity} onChange={(x) => set('sensitivity', x)} hint="分析器驱动视觉的强度" />
            <Slider label="鼓点灵敏度" value={v.beatResponse} onChange={(x) => set('beatResponse', x)} hint="鼓点被识别的难易程度" />
            <Slider label="辉光" value={v.glow} onChange={(x) => set('glow', x)} hint="界面散发的光量" />
            <Slider label="背景暗度" value={v.darkness} onChange={(x) => set('darkness', x)} hint="音乐背后房间被压暗的程度" />
            <Slider label="3D 纵深" value={v.depth} onChange={(x) => set('depth', x)} hint="专辑舞台伸入房间的深度" />
          </div>
        </GlassPanel>

        <GlassPanel tier="soft" className="rounded-3xl p-5">
          <h2 className="mh-display text-[16px]">细节与性能</h2>
          <div className="mt-4 space-y-5">
            <Field label="取色来源" hint="随机:每个元素各自散色">
              <div className="flex gap-1.5">
                {PARTICLE_COLOR_LABELS.map((c) => (
                  <Chip key={c.id} on={s.settings.particleColor === c.id} onClick={() => s.setSetting('particleColor', c.id as ParticleColor)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="细节" hint="可视化效果的分辨率">
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high', 'ultra'] as ParticleDensity[]).map((d) => (
                  <Chip key={d} on={v.density === d} onClick={() => set('density', d)}>
                    {{ low: '低', medium: '中', high: '高', ultra: '极高' }[d]}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="性能模式" hint="音频永远优先;这里决定视觉能用多少性能">
              <div className="flex flex-wrap gap-1.5">
                {PERF_MODE_LABELS.map((p) => (
                  <Chip key={p.id} on={v.perf === p.id} onClick={() => set('perf', p.id as PerfMode)} title={p.hint}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
              {PERF_MODE_LABELS.find((p) => p.id === v.perf)?.hint}
            </p>
          </div>
        </GlassPanel>
      </section>

      <div className="mt-6 pl-1">
        <button className="text-[12.5px] underline" onClick={() => { useUiStore.getState().navigate('settings'); pushPath('/settings') }}>
          全部设置
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium">{label}</div>
      {hint && <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</div>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[12px] transition-colors duration-200"
      style={{
        background: on ? 'var(--c-tint)' : 'rgba(255,255,255,0.05)',
        color: on ? 'var(--c-accent-2)' : 'var(--c-ink-faint)',
        boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.16)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

function Slider({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="mh-mono text-[11.5px]" style={{ color: 'var(--c-ink-dim)' }}>{Math.round(value * 100)}%</span>
      </span>
      {hint && <span className="mt-0.5 block text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>{hint}</span>}
      <input
        type="range" min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2 w-full"
        style={{ ['--fill' as any]: `${value * 100}%` }}
        aria-label={label}
      />
    </label>
  )
}

export { IconClose, rgba, useEffect, useState }
