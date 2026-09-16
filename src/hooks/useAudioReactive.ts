import { useEffect, useRef } from 'react'
import { audio, type Levels } from '../audio/engine'
import { useSettingsStore } from '../stores/settings'
import { useReducedMotion } from './useMedia'

/**
 * Bind imperative per-frame DOM updates to the audio analysis.
 * Returns an unsubscribe that also stops the shared rAF loop.
 * Respects prefers-reduced-motion and the in-app animation toggle.
 */
export function useAudioReactive(
  update: (el: HTMLElement, levels: Levels, dt: number) => void,
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const animations = useSettingsStore((s) => s.settings.animations)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!animations || reduced) return
    const off = audio.onFrame((levels, dt) => {
      const el = ref.current
      if (el) update(el, levels, dt)
    })
    return off
  }, [animations, reduced, update])

  return ref
}
