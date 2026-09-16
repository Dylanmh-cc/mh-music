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
import type { BgMode, PerfMode, ParticleColor, ParticleDensity, Palette } from '../types/models'

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
          <h1 className="mh-display text-[30px] md:text-[36px]">Visualizer</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>
            {album ? `${album.name} — ${album.artist}` : 'Play something to see it move'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton onClick={() => { useUiStore.getState().toggleNowPlaying(true); pushPath('/player') }}>
            Open the space
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
              <IconButton label="Previous" className="h-9 w-9" onClick={() => player.prev()}><IconPrev size={16} /></IconButton>
              <button
                className="lg-btn lg-btn-primary grid h-11 w-11 place-items-center rounded-full"
                onClick={player.toggle}
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
              </button>
              <IconButton label="Next" className="h-9 w-9" onClick={() => player.next()}><IconNext size={16} /></IconButton>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ── modes ──────────────────────────────────────────────────────── */}
      <section className="mt-7" aria-label="Visualizer modes">
        <h2 className="mh-display mb-3 pl-1 text-[17px]">Mode</h2>
        <div className="mh-mode-grid">
          {VISUALIZER_MODE_LABELS.map((m) => (
            <button
              key={m.id}
              className="mh-mode-card"
              data-on={s.settings.visualizerMode === m.id ? 'true' : undefined}
              aria-pressed={s.settings.visualizerMode === m.id}
              onClick={() => s.setSetting('visualizerMode', m.id)}
            >
              <div className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{m.id}</div>
              <div className="mt-1 text-[14px] font-semibold">{m.label}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>{m.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── the room it plays in ───────────────────────────────────────── */}
      <section className="mt-8" aria-label="Playback background">
        <h2 className="mh-display mb-3 pl-1 text-[17px]">Background</h2>
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
      <section className="mt-8 grid gap-4 lg:grid-cols-2" aria-label="Response">
        <GlassPanel tier="soft" className="rounded-3xl p-5">
          <h2 className="mh-display text-[16px]">Response</h2>
          <div className="mt-4 space-y-4">
            <Slider label="Music sensitivity" value={v.sensitivity} onChange={(x) => set('sensitivity', x)} hint="How hard the analyser drives the visuals" />
            <Slider label="Beat response" value={v.beatResponse} onChange={(x) => set('beatResponse', x)} hint="How readily drum hits register" />
            <Slider label="Glow" value={v.glow} onChange={(x) => set('glow', x)} hint="How much light the interface throws" />
            <Slider label="Background darkness" value={v.darkness} onChange={(x) => set('darkness', x)} hint="How far the room is pushed down behind the music" />
            <Slider label="3D depth" value={v.depth} onChange={(x) => set('depth', x)} hint="How far the album stage reaches into the room" />
          </div>
        </GlassPanel>

        <GlassPanel tier="soft" className="rounded-3xl p-5">
          <h2 className="mh-display text-[16px]">Detail & performance</h2>
          <div className="mt-4 space-y-5">
            <Field label="Colour source" hint="Random gives every element its own scattered hue">
              <div className="flex gap-1.5">
                {PARTICLE_COLOR_LABELS.map((c) => (
                  <Chip key={c.id} on={s.settings.particleColor === c.id} onClick={() => s.setSetting('particleColor', c.id as ParticleColor)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Detail" hint="How finely the visualiser is resolved">
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high', 'ultra'] as ParticleDensity[]).map((d) => (
                  <Chip key={d} on={v.density === d} onClick={() => set('density', d)}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Performance mode" hint="Audio always has priority; this decides what the visuals may spend">
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
          All settings
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
