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

export function SettingsView() {
  return (
    <div className="mx-auto max-w-[760px] pb-10">
      <h1 className="mb-2 mt-4 text-[26px] font-bold tracking-tight">Settings</h1>
      <p className="mb-8 text-[13px]" style={{ color: 'var(--c-ink-dim)' }}>Everything is saved to your account, per browser.</p>
      <AppearanceSection />
      <AnimationSection />
      <AlbumSection />
      <LyricsSection />
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
    <div className="flex items-center justify-between gap-6 py-3">
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
    <div className="glass-soft flex rounded-full p-0.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-full px-3.5 py-2 text-[12.5px] transition-colors', value === o.value ? 'font-medium text-[var(--c-ink)]' : 'text-[var(--c-ink-faint)] hover:text-white')}
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
    <div className="flex w-[248px] items-center gap-3">
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
    <Card title="Account" hint={`Signed in as ${user?.name} (${user?.email})`}>
      <div className="flex items-center gap-2">
        <input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} className="w-[150px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25" aria-label="Current password" />
        <input type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} className="w-[150px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25" aria-label="New password" />
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={async () => {
            setMsg('')
            try {
              await changePassword(user!.id, cur, next)
              setMsg('Password updated.')
              setCur(''); setNext('')
            } catch (e: any) { setMsg(e.message) }
          }}
        >
          Update
        </button>
        {msg && <span className="text-[11.5px]" style={{ color: 'var(--c-accent-2)' }}>{msg}</span>}
      </div>
      <Row label="Log out of this device">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={logout}>Log out</button>
      </Row>
    </Card>
  )
}

function AppearanceSection() {
  const s = useSettingsStore()
  return (
    <Card title="Appearance">
      <Row label="Theme" hint="Dynamic colors follow the current album’s artwork">
        <Segmented<ThemeMode>
          ariaLabel="theme"
          value={s.settings.theme}
          onChange={(v) => { s.setSetting('theme', v); if (v !== 'dynamic') s.setSetting('dynamicColors', false); else s.setSetting('dynamicColors', true) }}
          options={[
            { value: 'dynamic', label: 'Dynamic' },
            { value: 'dark', label: 'Dark' },
            { value: 'black', label: 'Black' },
            { value: 'midnight', label: 'Midnight' },
            { value: 'glass', label: 'Glass' },
          ]}
        />
      </Row>
      <Row label="Dynamic album colors" hint="Repaint the environment from each album’s palette">
        <Toggle on={s.settings.dynamicColors} onChange={(v) => s.setSetting('dynamicColors', v)} label="Dynamic album colors" />
      </Row>
      <Row label="Music landscape" hint="The playback page raises a block terrain out of the track — this is the only visualiser, and it is always album-coloured.">
        <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>Voxel landscape · on</span>
      </Row>
      <Row label="Landscape colour" hint="Random gives every block its own scattered colour; Album Cover draws them from the current artwork.">
        <Segmented<ParticleColor>
          ariaLabel="landscape colour"
          value={s.settings.particleColor}
          onChange={(v) => s.setSetting('particleColor', v)}
          options={PARTICLE_COLOR_LABELS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </Row>
      <Row label="Playback mode" hint="Sequential, shuffle and repeat-one are exclusive">
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
    <Card title="Album" hint="Position, rotation, scale, depth, shadow and reflection — global or per album.">
      <Row label="Card scale" hint="Global multiplier applied to every 3D album sleeve">
        <Slider
          label="Album scale" value={g.scale} min={0.7} max={1.4} step={0.01}
          onChange={(v) => s.setLayoutGlobal({ scale: v })}
          format={(v) => `${v.toFixed(2)}×`}
        />
      </Row>
      <Row label="Shadow depth" hint="How far the sleeve floats above the wall">
        <Slider
          label="Album shadow" value={g.shadow} min={0} max={1.2} step={0.05}
          onChange={(v) => s.setLayoutGlobal({ shadow: v })}
          format={(v) => v.toFixed(2)}
        />
      </Row>
      <Row label="Floor reflection" hint="The sleeve’s mirrored ghost below the card">
        <Slider
          label="Album reflection" value={g.reflection} min={0} max={1} step={0.05}
          onChange={(v) => s.setLayoutGlobal({ reflection: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Row>
      <Row label="Tune a single album" hint={`${albumCount} albums in your library`}>
        <div className="flex gap-2">
          <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => useUiStore.getState().navigate('albums')}>Open album wall</button>
          <button
            className="lg-btn px-4 py-2 text-[12.5px]"
            onClick={() => { s.resetLayout(); toast('info', 'Global album layout reset.') }}
          >
            Reset global
          </button>
        </div>
      </Row>
    </Card>
  )
}

function AnimationSection() {
  const s = useSettingsStore()
  return (
    <Card title="Animation">
      <Row label="Interface animations" hint="Ambient drift, tilt, breathing and hover blur. Off also calms every stage effect; your system’s reduce-motion preference is always respected.">
        <Toggle on={s.settings.animations} onChange={(v) => s.setSetting('animations', v)} label="Animations" />
      </Row>
      <Row label="Living background" hint="Starfield, molecule network, beat ripples and the bass ribbon">
        <Toggle on={s.settings.ambientStage} onChange={(v) => s.setSetting('ambientStage', v)} label="Ambient stage" />
      </Row>
      <Row label="Street texture" hint="Halftone spray, stencil marks and tape edges in the room">
        <Toggle on={s.settings.streetTexture} onChange={(v) => s.setSetting('streetTexture', v)} label="Street texture" />
      </Row>
      <Row label="Skip intro animation" hint="Skip the turntable opening on this device">
        <Toggle on={s.settings.skipIntro} onChange={(v) => s.setSetting('skipIntro', v)} label="Skip intro" />
      </Row>
      <Row label="Replay intro" hint="Play the turntable opening again">
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => {
            useUiStore.getState().setIntroDone(false)
            useUiStore.getState().navigate('home')
          }}
        >
          Replay intro
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
    <Card title="Lyrics" hint="Lyrics drift with the music — tune their presence here.">
      <Row label="Font size">
        <Slider label="Lyrics size" value={L.size} min={13} max={34} step={1} onChange={(v) => set('size', v)} format={(v) => `${v}px`} />
      </Row>
      <Row label="Opacity">
        <Slider label="Lyrics opacity" value={L.opacity} min={0.3} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Visible lines">
        <Segmented<string> ariaLabel="lyrics lines" value={String(L.lines)} onChange={(v) => set('lines', parseInt(v, 10))} options={[1, 3, 5, 7].map((n) => ({ value: String(n), label: String(n) }))} />
      </Row>
      <Row label="Position in the room" hint="Where the lyric column sits relative to the record">
        <Segmented<LyricsSettings['side']> ariaLabel="lyrics side" value={L.side} onChange={(v) => set('side', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
      </Row>
      <Row label="Line transition" hint="How one line gives way to the next">
        <Segmented<LyricsSettings['motion']> ariaLabel="lyrics motion" value={L.motion} onChange={(v) => set('motion', v)} options={[{ value: 'fade', label: 'Fade' }, { value: 'slide', label: 'Slide' }, { value: 'blur', label: 'Blur' }, { value: 'scale', label: 'Scale' }]} />
      </Row>
      <Row label="Translation" hint="Shows the translated line under the one being sung, when the file carries it">
        <Toggle on={L.translation} onChange={(v) => set('translation', v)} label="Lyric translation" />
      </Row>
      <Row label="Next line" hint="Off leaves only the line being sung in the window">
        <Toggle on={L.showNext} onChange={(v) => set('showNext', v)} label="Show the next line" />
      </Row>
      <Row label="Position">
        <Segmented<LyricsSettings['mode']> ariaLabel="lyrics mode" value={L.mode} onChange={(v) => set('mode', v)} options={[{ value: 'floating', label: 'Floating' }, { value: 'centered', label: 'Centered' }, { value: 'bottom', label: 'Bottom' }]} />
      </Row>
      <Row label="Alignment">
        <Segmented<LyricsSettings['align']> ariaLabel="lyrics align" value={L.align} onChange={(v) => set('align', v)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
      </Row>
      <Row label="Line spacing">
        <Slider label="Lyrics gap" value={L.gap} min={4} max={40} step={1} onChange={(v) => set('gap', v)} format={(v) => `${v}px`} />
      </Row>
      <Row label="Animation speed">
        <Slider label="Lyrics speed" value={L.speed} min={0.5} max={2} step={0.1} onChange={(v) => set('speed', v)} format={(v) => `${v.toFixed(1)}×`} />
      </Row>
      <Row label="Lyrics animation" hint="Word-by-word fill sweeps across the line as it is sung">
        <Toggle on={L.animate} onChange={(v) => set('animate', v)} label="Lyrics animation" />
      </Row>
      <Row label="Highlight color">
        <div className="flex items-center gap-2">
          {['#ffffff', 'var(--c-accent-2)', 'var(--c-accent)', '#ffd166', '#ff9ad5', '#9dffb0'].map((c) => (
            <button
              key={c}
              aria-label={`Highlight ${c}`}
              onClick={() => set('highlight', c)}
              className="grid h-6 w-6 place-items-center rounded-full border border-white/20"
              style={{ background: c.startsWith('var') ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || '#fff' : c }}
            >
              {L.highlight === c && <IconCheck size={12} style={{ color: '#111' }} />}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Reset lyrics settings">
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => { (Object.keys(DEFAULT_LYRICS) as Array<keyof LyricsSettings>).forEach((k) => set(k, DEFAULT_LYRICS[k])); toast('info', 'Lyrics settings restored.') }}
        >
          Reset Lyrics
        </button>
      </Row>
    </Card>
  )
}

function PlaybackSection() {
  const s = useSettingsStore()
  const player = usePlayerStore()
  return (
    <Card title="Playback">
      <Row label="Default volume" hint="Applied on load and remembered across sessions">
        <Slider label="Volume" value={s.settings.volume} min={0} max={1} step={0.01} onChange={(v) => player.setVolume(v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Crossfade" hint="Dips the outgoing track and brings the next one up when you change songs">
        <Slider label="Crossfade" value={s.settings.crossfade} min={0} max={6} step={0.5} onChange={(v) => s.setSetting('crossfade', v)} format={(v) => (v === 0 ? 'Off' : `${v.toFixed(1)}s`)} />
      </Row>
      <Row label="Volume glide" hint="Smooth the volume ramp when a track starts">
        <Toggle on={s.settings.smoothVolume} onChange={(v) => s.setSetting('smoothVolume', v)} label="Volume glide" />
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
    <Card title="Visuals" hint="How the music space looks, and how strongly it answers the track.">
      <Row label="Visualizer mode" hint={VISUALIZER_MODE_LABELS.find((m) => m.id === s.settings.visualizerMode)?.hint}>
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
      <Row label="Visualizer colour" hint="Album draws from the current artwork; Random gives every element its own hue.">
        <Segmented<ParticleColor>
          ariaLabel="visualizer colour"
          value={s.settings.particleColor}
          onChange={(val) => s.setSetting('particleColor', val)}
          options={PARTICLE_COLOR_LABELS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </Row>
      <Row label="Player background" hint={BG_MODE_LABELS.find((b) => b.id === s.settings.bgMode)?.hint}>
        <Segmented<BgMode>
          ariaLabel="player background"
          value={s.settings.bgMode}
          onChange={(val) => s.setBgMode(val)}
          options={BG_MODE_LABELS.map((b) => ({ value: b.id, label: b.label }))}
        />
      </Row>
      <Row label="Detail" hint="How finely the visualiser is resolved; higher needs a stronger GPU">
        <Segmented<ParticleDensity>
          ariaLabel="visualizer detail"
          value={v.density}
          onChange={(val) => set('density', val)}
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }]}
        />
      </Row>
      <Row label="Performance mode" hint={PERF_MODE_LABELS.find((p) => p.id === v.perf)?.hint}>
        <Segmented<PerfMode>
          ariaLabel="performance mode"
          value={v.perf}
          onChange={(val) => set('perf', val)}
          options={PERF_MODE_LABELS.map((p) => ({ value: p.id, label: p.label }))}
        />
      </Row>
      <Row label="Music sensitivity" hint="How hard the analyser pushes the visuals">
        <Slider label="Sensitivity" value={v.sensitivity} min={0} max={1} step={0.05} onChange={(val) => set('sensitivity', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="Beat response" hint="How readily drum hits register as beats">
        <Slider label="Beat response" value={v.beatResponse} min={0} max={1} step={0.05} onChange={(val) => set('beatResponse', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="Record size" hint="The sleeve and its record scale together, so they always match">
        <Slider label="Record size" value={v.vinylSize} min={0.5} max={2} step={0.05} onChange={(val) => set('vinylSize', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="Background opacity" hint="How strongly the room shows through the visualisation">
        <Slider label="Background opacity" value={v.bgOpacity} min={0} max={1} step={0.05} onChange={(val) => set('bgOpacity', val)} format={(val) => `${Math.round(val * 100)}%`} />
      </Row>
      <Row label="Glass blur" hint="Liquid-glass blur across the console, panels and player">
        <Slider label="Glass blur" value={v.glassBlur} min={0} max={1} step={0.05} onChange={(val) => set('glassBlur', val)} format={(val) => `${Math.round(val * 100)}%`} />
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
    <Card title="Library" hint="Manage the folders, history and data behind your collection.">
      <Row label="Music folders" hint={`${lib.folders.length} linked · ${lib.songs.length} tracks in your library`}>
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => navigate('folders')}>Manage folders</button>
      </Row>
      <Row
        label="Demo music"
        hint={demo ? `${demo} demo tracks are mixed into your library as a preview` : 'No demo tracks in your library'}
      >
        <button
          className="lg-btn px-4 py-2 text-[12.5px] text-[#ff9a8a] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!demo}
          onClick={() => askConfirm({
            title: 'Clear the demo music?',
            body: `${demo} demo track${demo !== 1 ? 's' : ''} will be removed from your library, along with their albums and any favorites. Music you added yourself is untouched.`,
            confirmLabel: 'Clear Demo Data',
            danger: true,
            onConfirm: () => lib.clearDemo(),
          })}
        >
          Clear Demo Data
        </button>
      </Row>
      <Row label="Listening history" hint={`${lib.history.length} play events recorded`}>
        <button
          className="lg-btn px-4 py-2 text-[12.5px]"
          onClick={() => askConfirm({
            title: 'Clear your listening history?',
            body: 'Recently Played will be emptied. Your library and playlists are not affected.',
            confirmLabel: 'Clear History',
            danger: true,
            onConfirm: () => { lib.clearHistory(); toast('info', 'Listening history cleared.') },
          })}
        >
          Clear history
        </button>
      </Row>
      <Row label="Reset all settings" hint="Theme, lyrics, animations — back to first light. Your library is kept.">
        <button
          className="lg-btn px-4 py-2 text-[12.5px] text-[#ff9a8a]"
          onClick={() => askConfirm({
            title: 'Reset all settings to defaults?',
            body: 'Appearance, animation, lyrics and album layout return to their defaults. Your music library, favorites and playlists are kept.',
            confirmLabel: 'Reset Settings',
            danger: true,
            onConfirm: () => { reset(); toast('info', 'Settings reset.') },
          })}
        >
          Reset Settings
        </button>
      </Row>
    </Card>
  )
}

function ShortcutsSection() {
  const rows: Array<[string, string]> = [
    ['Space', 'Play / Pause'],
    ['← / →', 'Seek ±5s'],
    ['Shift + ← / →', 'Previous / next track'],
    ['↑ / ↓', 'Volume'],
    ['M', 'Mute'],
    ['S', 'Shuffle'],
    ['R', 'Repeat mode'],
    ['F', 'Favorite the current track'],
    ['L', 'Open the lyrics space'],
    ['V', 'Open the visualizer'],
    ['/', 'Search'],
    ['Esc', 'Close the overlay / leave the 3D space'],
  ]
  return (
    <Card title="Keyboard Shortcuts">
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
    <Card title="Audio" hint="The engine. Playback always has priority over everything drawn on screen.">
      <Row label="Output volume" hint="The same level the dock controls">
        <Slider label="Volume" value={s.settings.volume} min={0} max={1} step={0.01} onChange={(v) => player.setVolume(v)} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Mute">
        <Toggle on={player.muted} onChange={() => player.toggleMute()} label="Muted" />
      </Row>
      <Row label="Crossfade" hint="How long one track takes to give way to the next">
        <Slider label="Crossfade" value={s.settings.crossfade} min={0} max={6} step={0.5} onChange={(v) => s.setSetting('crossfade', v)} format={(v) => (v ? `${v.toFixed(1)}s` : 'Off')} />
      </Row>
      <Row label="Smooth volume" hint="Ramp volume changes instead of jumping to them">
        <Toggle on={s.settings.smoothVolume} onChange={(v) => s.setSetting('smoothVolume', v)} label="Smooth volume" />
      </Row>
      <Row label="Now playing" hint="Track, position and queue state are shared across every page">
        <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          {player.songId ? 'Engine running' : 'Idle — nothing loaded'}
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
      toast('success', 'Library exported as JSON.')
    } catch {
      toast('error', 'The export could not be written.')
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
    toast('success', 'Favorites exported as M3U8.')
  }

  return (
    <Card title="Import / Export" hint="Move your library in and out without a server in the middle.">
      <Row label="Import a playlist" hint="JSON · M3U · M3U8 · CSV, matched against your local files">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => { navigate('import'); pushPath('/import') }}>
          Open the importer
        </button>
      </Row>
      <Row label="Export the library" hint="Albums, favorites, playlists and history as one JSON document">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => void exportJson()} disabled={busy}>
          {busy ? 'Writing…' : 'Export JSON'}
        </button>
      </Row>
      <Row label="Export favorites" hint="A standard M3U8 that any player can read">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={exportM3U}>Export M3U8</button>
      </Row>
      <Row label="Add music" hint="Folders are read in the browser; nothing is uploaded">
        <button className="lg-btn px-4 py-2 text-[12.5px]" onClick={() => { navigate('folders'); pushPath('/folders') }}>
          Manage folders
        </button>
      </Row>
    </Card>
  )
}

/** Privacy — what is stored, where, and what never leaves the device. */
function PrivacySection() {
  return (
    <Card title="Privacy" hint="What MH Music keeps, and where it keeps it.">
      <div className="space-y-2.5 px-1 pb-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
        <p><strong style={{ color: 'var(--c-ink)' }}>Audio never leaves your device.</strong> Folders are read with the File System Access API (or a file picker where that is unavailable), decoded locally, and played from a blob URL. There is no upload step anywhere in the app.</p>
        {REMOTE_AUTH ? (
          <p><strong style={{ color: 'var(--c-ink)' }}>Your account lives on the server.</strong> Your display name, email, a scrypt password hash with a per-account salt (never the plain password), and a session token are stored on the accounts server, so one sign-in works from any browser. Your music files, library, favourites and playlists still stay in this browser only.</p>
        ) : (
          <p><strong style={{ color: 'var(--c-ink)' }}>Your account is local.</strong> Passwords are stored only as a PBKDF2-SHA256 hash with a per-account salt — never in plain text. The auth module is written against a small adapter interface so a real backend can replace it without touching the UI.</p>
        )}
        <p><strong style={{ color: 'var(--c-ink)' }}>Every account is isolated.</strong> Library, favorites, playlists, history, settings, lyric and layout preferences are namespaced per user; signing in as someone else shows none of it.</p>
        <p><strong style={{ color: 'var(--c-ink)' }}>Deleting is explicit.</strong> Removing a track takes it out of the library. Deleting the original file is always a separate, second confirmation.</p>
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
        toast('success', 'Connected to NetEase Cloud Music.')
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
            toast('success', 'Connected to NetEase Cloud Music.')
            setPlaylists(await fetchPlaylists())
          } else if (st.code === 800) {
            window.clearInterval(poll.current)
            setQr(null)
            toast('error', 'That code expired — try again.')
          }
        } catch {
          window.clearInterval(poll.current)
          setQr(null)
        }
      }, 2000)
    } catch (e) {
      toast('error', e instanceof Error && e.message === 'unconfigured'
        ? 'Add your backend address first.'
        : 'The endpoint could not be reached.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => () => window.clearInterval(poll.current), [])

  const importOne = async (pl: NeteasePlaylist) => {
    try {
      const res = await importPlaylist(pl)
      toast('success', `“${pl.name}” imported — ${res.matched} of ${res.matched + res.missing} tracks matched.`)
    } catch {
      toast('error', `“${pl.name}” could not be imported.`)
    }
  }

  return (
    <Card title="NetEase Cloud Music" hint="Connect through your own backend — never with a key in the browser.">
      <Row label="Integration track" hint="The platform's own docs list both: a browser SDK for the web track, and a REST track whose secrets stay on your server.">
        <Segmented<'none' | 'jssdk' | 'backend'>
          ariaLabel="NetEase integration track"
          value={cfg.strategy}
          onChange={(v) => set({ strategy: v })}
          options={[
            { value: 'none', label: 'Off' },
            { value: 'jssdk', label: 'Web SDK' },
            { value: 'backend', label: 'My server' },
          ]}
        />
      </Row>
      {cfg.strategy === 'jssdk' && (
        <Row label="SDK script URL" hint="The browser SDK from the open platform's 文档中心 (网页应用接入). It runs the sign-in on NetEase's domain.">
          <input
            value={cfg.sdkUrl}
            onChange={(e) => set({ sdkUrl: e.target.value })}
            placeholder="https://…/netease-music-sdk.js"
            className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
            aria-label="NetEase SDK script URL"
          />
        </Row>
      )}
      <Row label="App ID" hint="The public identifier from the open-platform console. It is safe to keep here.">
        <input
          value={cfg.appId}
          onChange={(e) => set({ appId: e.target.value })}
          placeholder="b3010d…"
          className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
          aria-label="NetEase App ID"
        />
      </Row>
      <Row label="Backend endpoint" hint="Your server, which holds the AppSecret and the private key and signs every call.">
        <input
          value={cfg.endpoint}
          onChange={(e) => set({ endpoint: e.target.value })}
          placeholder="https://your-server.example/music"
          className="w-[300px] rounded-xl bg-white/5 px-3 py-2 text-[12.5px] outline-none placeholder:text-white/25"
          aria-label="NetEase backend endpoint"
        />
      </Row>

      <Row label="Status">
        <div className="flex items-center gap-2">
          <span className="mh-mono text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>
            {status() === 'unconfigured' ? 'No endpoint set'
              : status() === 'offline' ? 'Configured, not signed in'
                : status() === 'ready' ? 'Endpooint reachable, ready to scan'
                  : 'Signed in'}
          </span>
          {getSession()
            ? <button className="lg-btn px-3.5 py-1.5 text-[12px]" onClick={() => { signOut(); set({ enabled: false }); setPlaylists(null); toast('info', 'Signed out of NetEase.') }}>Sign out</button>
            : <button className="lg-btn lg-btn-primary px-3.5 py-1.5 text-[12px]" disabled={busy || !isConfigured(cfg)} onClick={() => void connect()}>{busy ? 'Starting…' : 'Connect'}</button>}
        </div>
      </Row>

      {qr && (
        <Row label="Scan to sign in" hint="Open NetEase Cloud Music on your phone and scan this code.">
          <img src={qr.qrImage} alt="NetEase sign-in QR code" className="h-[132px] w-[132px] rounded-xl bg-white p-1.5" />
        </Row>
      )}

      {playlists && (
        <Row label="My NetEase playlists" hint="Importing keeps names and artwork; tracks are matched against your own files.">
          <div className="max-h-[220px] w-[420px] space-y-1 overflow-y-auto pr-1">
            {playlists.length === 0 && <span className="text-[12.5px]" style={{ color: 'var(--c-ink-faint)' }}>No playlists on that account.</span>}
            {playlists.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {p.coverUrl
                  ? <img src={p.coverUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  : <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'var(--c-tint)' }}>{p.name.slice(0, 1)}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]">{p.name}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--c-ink-faint)' }}>{p.trackCount ?? '?'} tracks</span>
                </span>
                <button className="lg-btn px-3 py-1.5 text-[11.5px]" onClick={() => void importOne(p)}>Import</button>
              </div>
            ))}
          </div>
        </Row>
      )}

      <div className="px-1 pb-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-ink-faint)' }}>
        Why a backend: NetEase signs every request with an AppSecret and an RSA private key. Those
        belong on a server — anything shipped in the browser bundle is public the moment the page
        loads. MH Music therefore stores only the AppID and your endpoint, and never sees the keys.
        Streaming NetEase audio additionally needs their licensed SDK and is out of scope here;
        this imports the playlists themselves, which is what a browser can honestly do.
      </div>
    </Card>
  )
}

/** About — what this is, and what it is built from. */
function AboutSection() {
  const s = useSettingsStore()
  return (
    <Card title="About MH Music" hint="Music Beyond Sound.">
      <div className="space-y-3 px-1 pb-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-ink-dim)' }}>
        <p>
          An immersive player built around a record: album-driven colour, a real 3D turntable for the
          opening, a visualiser that answers the track, and liquid glass for everything you touch.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            ['Audio', 'Web Audio API · AnalyserNode'],
            ['3D', 'Three.js · WebGL · CSS 3D'],
            ['Interface', 'React 18 · TypeScript · Framer Motion'],
            ['Storage', 'IndexedDB · per-user namespaces'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="mh-overline" style={{ color: 'var(--c-ink-faint)' }}>{k}</div>
              <div className="mt-0.5 text-[12px]">{v}</div>
            </div>
          ))}
        </div>
        <p className="text-[11.5px]" style={{ color: 'var(--c-ink-faint)' }}>
          Version 1.0 · theme {s.settings.theme} · {s.settings.visualizerMode} visualiser · {s.settings.visual.perf} performance
        </p>
      </div>
    </Card>
  )
}
