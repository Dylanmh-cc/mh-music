import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import { useSettingsStore } from '../stores/settings'
import { applyTheme, DEFAULT_PALETTE } from '../lib/color'
import { setReactivity } from '../audio/engine'
import type { Palette } from '../types/models'

const BASE_PALETTES: Record<string, Palette> = {
  dark: { primary: '#8f9dff', accent: '#c3d2ff', glow: 'rgba(143,157,255,0.35)', deep: '#0a0c12', deep2: '#10131c', soft: '#181c28' },
  black: { primary: '#9aa2b2', accent: '#e8ecf2', glow: 'rgba(154,162,178,0.3)', deep: '#000000', deep2: '#060708', soft: '#121317' },
  midnight: { primary: '#4d7dd6', accent: '#7fb0ff', glow: 'rgba(77,125,214,0.35)', deep: '#04070f', deep2: '#081020', soft: '#0d1830' },
  glass: { primary: '#9fb4c4', accent: '#dfeaf2', glow: 'rgba(159,180,196,0.32)', deep: '#101418', deep2: '#171d24', soft: '#1d242c' },
  // the two "sky" themes: aurora keeps the cool end of the spectrum, sunset the
  // warm end — both still dark enough to be a listening room
  aurora: { primary: '#4ad2b0', accent: '#8f7bff', glow: 'rgba(74,210,176,0.36)', deep: '#040a10', deep2: '#08161c', soft: '#0d2226' },
  sunset: { primary: '#ff8a4c', accent: '#ff5f8f', glow: 'rgba(255,138,76,0.36)', deep: '#0d0508', deep2: '#1a0a10', soft: '#241016' },
}

/** Applies the current album's palette (or fixed theme) to CSS variables. */
export function useTheme(): void {
  const songId = usePlayerStore((s) => s.songId)
  const albumId = useLibraryStore((s) => s.songs.find((x) => x.id === songId)?.albumId)
  const palette = useLibraryStore((s) => s.albums.find((a) => a.id === albumId)?.palette)
  const dynamic = useSettingsStore((s) => s.settings.dynamicColors)
  const theme = useSettingsStore((s) => s.settings.theme)
  const animations = useSettingsStore((s) => s.settings.animations)
  const glassBlur = useSettingsStore((s) => s.settings.visual.glassBlur)
  const glow = useSettingsStore((s) => s.settings.visual.glow)
  const darkness = useSettingsStore((s) => s.settings.visual.darkness)
  const depth = useSettingsStore((s) => s.settings.visual.depth)
  const perf = useSettingsStore((s) => s.settings.visual.perf)
  const density = useSettingsStore((s) => s.settings.visual.density)
  const sensitivity = useSettingsStore((s) => s.settings.visual.sensitivity)
  const beatResponse = useSettingsStore((s) => s.settings.visual.beatResponse)

  // one place turns the visual settings into engine knobs + CSS variables, so
  // every consumer (visualiser, glass, background) reads the same source
  useEffect(() => {
    setReactivity({ sensitivity, beatResponse })
  }, [sensitivity, beatResponse])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--glass-blur', `${(6 + glassBlur * 26).toFixed(1)}px`)
    root.style.setProperty('--blur-app', `${(8 + glassBlur * 32).toFixed(1)}px`)
    root.style.setProperty('--mh-glow', glow.toFixed(2))
    root.style.setProperty('--mh-darkness', darkness.toFixed(2))
    root.style.setProperty('--mh-depth', depth.toFixed(2))
    // performance mode is a single attribute: the stylesheet trims blur and
    // shadow from it, so the layout never changes between modes
    root.dataset.perf = perf
    root.dataset.density = density
  }, [glassBlur, glow, darkness, depth, perf, density])

  useEffect(() => {
    const root = document.documentElement
    // `data-motion` lets the stylesheet calm idle drift and hover blur without
    // unmounting anything — the calm counterpart of the animations toggle
    root.dataset.motion = animations ? 'on' : 'off'
    if (!dynamic && theme !== 'dynamic') {
      root.dataset.theme = theme
      applyTheme(BASE_PALETTES[theme] ?? DEFAULT_PALETTE)
      return
    }
    root.dataset.theme = 'dynamic'
    applyTheme(palette ?? DEFAULT_PALETTE)
  }, [palette, dynamic, theme, animations])
}
