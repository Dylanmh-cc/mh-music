import { useEffect } from 'react'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { useSettingsStore } from '../stores/settings'
import { useLibraryStore } from '../stores/library'
import { pushPath, NOW_PLAYING_PATH } from '../app/router'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Global keyboard shortcuts (Space, arrows, M, S, R, /, Esc). */
export function useHotkeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState()
      const player = usePlayerStore.getState()
      if (isTyping(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      switch (e.key) {
        case ' ':
          e.preventDefault()
          player.toggle()
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) player.next()
          else player.seek(Math.min(player.duration || 0, player.position + 5))
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) player.prev()
          else player.seek(Math.max(0, player.position - 5))
          break
        case 'ArrowUp':
          e.preventDefault()
          player.setVolume(usePlayerStore.getState().muted ? 0.1 : playerVolume() + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          player.setVolume(playerVolume() - 0.05)
          break
        case 'm': case 'M':
          player.toggleMute()
          break
        case 's': case 'S':
          player.toggleShuffle()
          break
        case 'r': case 'R':
          player.cycleRepeat()
          break
        case 'f': case 'F': {
          // favourite whichever track is loaded, from anywhere in the app
          if (player.songId) useLibraryStore.getState().toggleFavSong(player.songId)
          break
        }
        case 'l': case 'L':
          // the lyrics live in the full-screen music space
          if (!ui.nowPlayingOpen) ui.toggleNowPlaying(true)
          pushPath(NOW_PLAYING_PATH)
          break
        case 'v': case 'V':
          ui.navigate('visualizer')
          pushPath('/visualizer')
          break
        case '/':
          e.preventDefault()
          ui.setSearchOpen(true)
          break
        case 'Escape':
          if (ui.ctx) ui.closeCtx()
          else if (ui.searchOpen) ui.setSearchOpen(false)
          else if (ui.nowPlayingOpen) ui.toggleNowPlaying(false)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

function playerVolume(): number {
  return useSettingsStore.getState().settings.volume
}
