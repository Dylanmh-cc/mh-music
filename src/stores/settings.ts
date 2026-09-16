import { create } from 'zustand'
import type { AlbumLayout, LyricsSettings, Settings, ThemeMode, ParticleColor, ViewMode, ViewPage, BgMode, ParticleDensity, VisualSettings, VisualizerMode, PerfMode } from '../types/models'
import { loadUser, saveUser } from '../services/storage'

export const DEFAULT_LAYOUT: AlbumLayout = {
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
  scale: 1, shadow: 0.5, depth: 40, reflection: 0.35,
}

export const DEFAULT_LYRICS: LyricsSettings = {
  // the playback page leads with the words, so the default line is large
  // enough to fill the frame the way the reference does
  size: 26, opacity: 0.95, lines: 4, align: 'center', mode: 'floating',
  side: 'center', motion: 'fade', translation: true, showNext: true, gap: 16, highlight: '#ffffff', speed: 1,
  animate: true,
}

export const DEFAULT_VISUALS: VisualSettings = {
  density: 'high',
  sensitivity: 0.75,
  beatResponse: 0.7,
  vinylSize: 1,
  bgOpacity: 1,
  glassBlur: 1,
  glow: 0.8,
  darkness: 0.6,
  depth: 0.7,
  perf: 'balanced',
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dynamic',
  dynamicColors: true,
  animations: true,
  ambientStage: true,
  streetTexture: true,
  skipIntro: false,
  volume: 0.8,
  crossfade: 0,
  smoothVolume: true,
  netease: { appId: '', endpoint: '', sdkUrl: '', strategy: 'none', enabled: false },
  lyrics: { ...DEFAULT_LYRICS },
  particleColor: 'album',
  visualizerMode: 'terrain',
  // the reference room: dark, with the landscape providing the only light
  bgMode: 'deep',
  visual: { ...DEFAULT_VISUALS },
  viewModes: { albums: 'stage', artists: 'stage', songs: 'stage', favorites: 'stage' },
  layouts: { global: { ...DEFAULT_LAYOUT }, perAlbum: {} },
}

interface SettingsState {
  settings: Settings
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  setLyric: <K extends keyof LyricsSettings>(key: K, value: LyricsSettings[K]) => void
  setVisual: <K extends keyof VisualSettings>(key: K, value: VisualSettings[K]) => void
  setLayoutGlobal: (patch: Partial<AlbumLayout>) => void
  setLayoutAlbum: (albumId: string, patch: Partial<AlbumLayout>) => void
  resetLayout: (albumId?: string) => void
  /** remember whether a browsing surface shows the 3D stage or a list */
  setViewMode: (page: ViewPage, mode: ViewMode) => void
  setBgMode: (mode: BgMode) => void
  resetSettings: () => void
  hydrate: (uid: string) => void
  volume: (v: number) => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function persist(s: SettingsState) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveUser('settings', s.settings), 300)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  setSetting: (key, value) => {
    set((s) => ({ settings: { ...s.settings, [key]: value } }))
    persist(get())
  },
  setLyric: (key, value) => {
    set((s) => ({ settings: { ...s.settings, lyrics: { ...s.settings.lyrics, [key]: value } } }))
    persist(get())
  },
  setVisual: (key, value) => {
    set((s) => ({ settings: { ...s.settings, visual: { ...s.settings.visual, [key]: value } } }))
    persist(get())
  },
  setBgMode: (mode) => {
    set((s) => ({ settings: { ...s.settings, bgMode: mode } }))
    persist(get())
  },
  setLayoutGlobal: (patch) => {
    set((s) => ({ settings: { ...s.settings, layouts: { ...s.settings.layouts, global: { ...s.settings.layouts.global, ...patch } } } }))
    persist(get())
  },
  setLayoutAlbum: (albumId, patch) => {
    set((s) => ({
      settings: {
        ...s.settings,
        layouts: {
          ...s.settings.layouts,
          perAlbum: { ...s.settings.layouts.perAlbum, [albumId]: { ...(s.settings.layouts.perAlbum[albumId] ?? DEFAULT_LAYOUT), ...patch } },
        },
      },
    }))
    persist(get())
  },
  resetLayout: (albumId) => {
    set((s) => {
      if (!albumId) return { settings: { ...s.settings, layouts: { ...s.settings.layouts, global: { ...DEFAULT_LAYOUT } } } }
      const per = { ...s.settings.layouts.perAlbum }
      delete per[albumId]
      return { settings: { ...s.settings, layouts: { ...s.settings.layouts, perAlbum: per } } }
    })
    persist(get())
  },
  resetSettings: () => {
    set({ settings: { ...DEFAULT_SETTINGS, lyrics: { ...DEFAULT_LYRICS }, visual: { ...DEFAULT_VISUALS }, layouts: { global: { ...DEFAULT_LAYOUT }, perAlbum: {} } } })
    persist(get())
  },
  setViewMode: (page, mode) => {
    set((s) => ({ settings: { ...s.settings, viewModes: { ...s.settings.viewModes, [page]: mode } } }))
    persist(get())
  },
  volume: (v) => get().setSetting('volume', v),
  hydrate: (uid) => {
    const saved = loadUser<Partial<Settings> | null>('settings', null)
    const settings: Settings = saved
      ? {
        ...DEFAULT_SETTINGS,
        ...saved,
        // older builds stored stage treatments or retired effect names —
        // anything we don't recognise falls back to the dark room
        particleColor: (saved as any).particleColor === 'random' ? 'random' : 'album',
        bgMode: isBgMode((saved as any).bgMode) ? (saved as any).bgMode : 'deep',
        visualizerMode: isVisualizerMode((saved as any).visualizerMode) ? (saved as any).visualizerMode : 'terrain',
        visual: { ...DEFAULT_VISUALS, ...((saved as any).visual ?? {}) },
        viewModes: { ...DEFAULT_SETTINGS.viewModes, ...((saved as any).viewModes ?? {}) },
        lyrics: { ...DEFAULT_LYRICS, ...(saved.lyrics ?? {}) },
        layouts: {
          global: { ...DEFAULT_LAYOUT, ...(saved.layouts?.global ?? {}) },
          perAlbum: saved.layouts?.perAlbum ?? {},
        },
      }
      : { ...DEFAULT_SETTINGS }
    set({ settings })
  },
}))

const BG_MODES: readonly BgMode[] = [
  'deep', 'glass', 'gradient', 'starry', 'sunset', 'spatial', 'vinyl', 'dynamic',
]

export function isBgMode(v: unknown): v is BgMode {
  return typeof v === 'string' && (BG_MODES as readonly string[]).includes(v)
}

export const VISUALIZER_MODES: readonly VisualizerMode[] = [
  'terrain', 'waveform', 'circular', 'particles', 'vinylWave', 'galaxy', 'aurora', 'minimal',
]

export function isVisualizerMode(v: unknown): v is VisualizerMode {
  return typeof v === 'string' && (VISUALIZER_MODES as readonly string[]).includes(v)
}

/** The eight visualiser modes, in the order they appear in the pickers. */
export const VISUALIZER_MODE_LABELS: ReadonlyArray<{ id: VisualizerMode; label: string; hint: string }> = [
  { id: 'terrain', label: '3D Terrain', hint: 'A block landscape rising out of the track, ringed by its own light' },
  { id: 'waveform', label: 'Classic Waveform', hint: 'The wave itself, drawn wide across the room' },
  { id: 'circular', label: 'Circular Spectrum', hint: 'The spectrum wrapped into a ring around the record' },
  { id: 'particles', label: 'Particles', hint: 'A drifting field that pushes outward on the bass' },
  { id: 'vinylWave', label: 'Vinyl Wave', hint: 'Ripples leaving the groove on every beat' },
  { id: 'galaxy', label: 'Galaxy', hint: 'Spiral arms turning slowly through the space' },
  { id: 'aurora', label: 'Aurora', hint: 'Bands of light drifting across the upper room' },
  { id: 'minimal', label: 'Minimal', hint: 'One hairline and a beat — nothing else moves' },
]

/** Performance mode: how much of the visual budget to spend. */
export const PERF_MODE_LABELS: ReadonlyArray<{ id: PerfMode; label: string; hint: string }> = [
  { id: 'high', label: 'High Quality', hint: 'Full particle counts, full glass blur, 3D at native resolution' },
  { id: 'balanced', label: 'Balanced', hint: 'Adapts to the device: good looking, still light' },
  { id: 'performance', label: 'Performance', hint: 'Fewer particles, less blur — audio always comes first' },
]

/** Landscape colour source, for pickers. */
export const PARTICLE_COLOR_LABELS: ReadonlyArray<{ id: ParticleColor; label: string }> = [
  { id: 'random', label: 'Random' },
  { id: 'album', label: 'Album Cover' },
]

/** Player background treatments, for pickers — the eight from the spec. */
export const BG_MODE_LABELS: ReadonlyArray<{ id: BgMode; label: string; hint: string }> = [
  { id: 'deep', label: 'Standard', hint: 'A dark room, lit by the landscape' },
  { id: 'glass', label: 'Glass', hint: 'Liquid glass space with the room refracted through it' },
  { id: 'gradient', label: 'Gradient', hint: 'A slow gradient built from the album palette' },
  { id: 'starry', label: 'Starry Sky', hint: 'A drifting starfield behind the music' },
  { id: 'sunset', label: 'Sunset', hint: 'Sunset band under a starry sky' },
  { id: 'spatial', label: '3D Space', hint: 'The full 3D room with its own depth' },
  { id: 'vinyl', label: 'Vinyl Room', hint: 'A listening room built around the record' },
  { id: 'dynamic', label: 'Dynamic', hint: 'Everything reacts to the track in real time' },
]

export type ThemeModeT = ThemeMode
