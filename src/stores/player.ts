import { create } from 'zustand'
import type { PlayMode, QueueItem, Song } from '../types/models'
import { audio } from '../audio/engine'
import { useLibraryStore } from './library'
import { useSettingsStore } from './settings'
import { toast } from './ui'
import { shuffle } from '../lib/rand'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  songId: string | null
  from: string
  context: string[]
  queue: QueueItem[]
  isPlaying: boolean
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  playMode: PlayMode
  position: number
  duration: number
  vinylOutFor: string | null

  onSession: () => void
  stopAll: () => void
  playSong: (songId: string, contextIds: string[], from: string) => Promise<void>
  toggle: () => Promise<void>
  next: (auto?: boolean) => Promise<void>
  prev: () => Promise<void>
  seek: (sec: number) => void
  syncPosition: (sec: number) => void
  syncDuration: (sec: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  /** sequential | shuffle | repeat-one — setting one clears the others */
  setPlayMode: (mode: PlayMode) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playNext: (songId: string) => void
  addToQueue: (songId: string) => void
  removeQueueAt: (index: number) => void
  moveInQueue: (from: number, to: number) => void
  clearQueue: () => void
  dropRemoved: (ids: string[]) => void
  setVinylOut: (albumId: string | null) => void
  setPlaying: (v: boolean) => void
  loadAndPlay: (songId: string) => Promise<void>
  __rebuildQueue: (afterId: string) => void
}

let wired = false
function wireEngine() {
  if (wired) return
  wired = true
  audio.setCallbacks(
    () => usePlayerStore.getState().next(true),
    () => {
      toast('error', '无法播放这首歌曲')
      const st = usePlayerStore.getState()
      if (st.queue.length || st.context.length) st.next(true)
      else st.setPlaying(false)
    },
  )
  audio.el.addEventListener('timeupdate', () => {
    usePlayerStore.getState().syncPosition(audio.el.currentTime)
  })
  audio.el.addEventListener('loadedmetadata', () => {
    usePlayerStore.getState().syncDuration(audio.el.duration || 0)
  })
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  songId: null,
  from: '',
  context: [],
  queue: [],
  isPlaying: false,
  muted: false,
  shuffle: false,
  repeat: 'off',
  playMode: 'sequential',
  position: 0,
  duration: 0,
  vinylOutFor: null,

  onSession: () => {
    wireEngine()
    const vol = useSettingsStore.getState().settings.volume
    audio.setVolume(vol, false)
  },

  stopAll: () => {
    audio.pause()
    set({ isPlaying: false, songId: null, queue: [], context: [], position: 0 })
  },

  playSong: async (songId, contextIds, from) => {
    const song = useLibraryStore.getState().getSong(songId)
    if (!song) { toast('error', '没有找到这首歌曲'); return }
    if (!song.url) {
      toast('error', '该文件不可用 —— 请在「音乐库 → 文件夹」里重新扫描它所在的文件夹。')
      return
    }
    set({ context: contextIds.length ? contextIds : [songId], from })
    get().__rebuildQueue(songId)
    await get().loadAndPlay(songId)
  },

  __rebuildQueue: (afterId) => {
    const { context, shuffle: sh } = get()
    const idx = context.indexOf(afterId)
    const rest = context.filter((id) => id !== afterId)
    const ordered = sh
      ? shuffle(rest)
      : idx >= 0 ? context.slice(idx + 1) : rest
    set({ queue: ordered.map((songId) => ({ songId, from: get().from })) })
  },

  loadAndPlay: async (songId: string) => {
    const lib = useLibraryStore.getState()
    const song = lib.getSong(songId)
    if (!song) return
    if (!song.url) {
      toast('error', '该文件不可用 —— 请在「音乐库 → 文件夹」里重新扫描它所在的文件夹。')
      return
    }
    wireEngine()
    audio.attach()
    await audio.resume()

    // crossfade: the outgoing track dips before the next one comes up
    const cfg = useSettingsStore.getState().settings
    const fade = Math.min(6, Math.max(0, cfg.crossfade))
    const outgoing = get().songId
    const replacing = !!outgoing && outgoing !== songId && get().isPlaying
    if (fade > 0 && replacing) await audio.rampVolume(0, fade)

    try {
      await audio.load(song.url)
    } catch {
      toast('error', '无法播放这首歌曲')
      return
    }
    const target = get().muted ? 0 : cfg.volume
    if (fade > 0 && replacing && cfg.smoothVolume) audio.setVolume(0, false)
    else audio.setVolume(target, cfg.smoothVolume)
    try {
      await audio.play()
    } catch {
      toast('info', '浏览器要求先有一次点击 —— 按播放键开始。')
      set({ songId, isPlaying: false, position: 0, duration: song.duration })
      return
    }
    if (fade > 0 && replacing && cfg.smoothVolume) void audio.rampVolume(target, fade)
    set({ songId, isPlaying: true, position: 0, duration: audio.duration || song.duration })
    lib.recordPlay(songId)
    lib.ensurePalette(song.albumId)
  },

  toggle: async () => {
    const st = get()
    if (!st.songId) {
      const songs = useLibraryStore.getState().songs
      if (!songs.length) { toast('info', '音乐库是空的 —— 请先添加音乐文件夹。'); return }
      await get().playSong(songs[0].id, songs.map((s) => s.id), '音乐库')
      return
    }
    if (st.isPlaying) {
      audio.pause()
      set({ isPlaying: false })
    } else {
      const song = useLibraryStore.getState().getSong(st.songId)
      if (song && !song.url) {
        toast('error', '该文件不可用 —— 请重新扫描它所在的文件夹。')
        return
      }
      audio.attach()
      await audio.resume()
      try { await audio.play(); set({ isPlaying: true }) } catch { /* needs gesture */ }
    }
  },

  next: async (auto = false) => {
    const st = get()
    const cur = st.songId
    if (!cur) return
    if (st.repeat === 'one' && auto) {
      audio.seek(0)
      try { await audio.play(); set({ isPlaying: true }) } catch { /* ignore */ }
      return
    }
    let nextId: string | null | undefined = st.queue[0]?.songId
    if (nextId) set((s) => ({ queue: s.queue.slice(1) }))
    else {
      const idx = st.context.indexOf(cur)
      if (idx >= 0 && idx < st.context.length - 1) nextId = st.context[idx + 1]
      else if (st.repeat === 'all' && st.context.length) nextId = st.context[0]
      else if (!auto && st.context.length) nextId = st.context[0]
    }
    if (nextId) {
      if (!st.queue.length) get().__rebuildQueue(nextId)
      await get().loadAndPlay(nextId)
    } else {
      audio.pause()
      set({ isPlaying: false })
    }
  },

  prev: async () => {
    const st = get()
    const cur = st.songId
    if (!cur) return
    if (audio.currentTime > 3) { audio.seek(0); return }
    const idx = st.context.indexOf(cur)
    const prevId = idx > 0 ? st.context[idx - 1] : st.context[st.context.length - 1] ?? null
    if (prevId) {
      get().__rebuildQueue(prevId)
      await get().loadAndPlay(prevId)
    }
  },

  seek: (sec) => {
    audio.seek(sec)
    set({ position: sec })
  },

  syncPosition: (sec) => { if (get().isPlaying) set({ position: sec }) },
  syncDuration: (sec) => { if (sec > 0) set({ duration: sec }) },

  setVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v))
    useSettingsStore.getState().volume(clamped)
    const smooth = useSettingsStore.getState().settings.smoothVolume
    audio.setVolume(get().muted ? 0 : clamped, smooth)
    if (clamped > 0 && get().muted) set({ muted: false })
  },

  toggleMute: () => {
    const muted = !get().muted
    set({ muted })
    audio.setVolume(muted ? 0 : useSettingsStore.getState().settings.volume)
  },

  setPlayMode: (mode) => {
    set({
      playMode: mode,
      shuffle: mode === 'shuffle',
      repeat: mode === 'repeat-one' ? 'one' : mode === 'repeat-all' ? 'all' : 'off',
    })
    if (get().songId) get().__rebuildQueue(get().songId!)
    toast('info', mode === 'shuffle' ? '随机播放'
      : mode === 'repeat-one' ? '单曲循环'
        : mode === 'repeat-all' ? '列表循环' : '顺序播放')
  },

  toggleShuffle: () => get().setPlayMode(get().playMode === 'shuffle' ? 'sequential' : 'shuffle'),

  /** cycles order → repeat all → repeat one → shuffle → order */
  cycleRepeat: () => {
    const order: PlayMode[] = ['sequential', 'repeat-all', 'repeat-one', 'shuffle']
    const i = order.indexOf(get().playMode)
    get().setPlayMode(order[(i + 1) % order.length])
  },

  playNext: (songId) => {
    set((s) => ({ queue: [{ songId, from: s.from }, ...s.queue] }))
    toast('success', '已设为下一首播放')
  },
  addToQueue: (songId) => {
    set((s) => ({ queue: [...s.queue, { songId, from: s.from }] }))
    toast('success', '已加入播放队列')
  },
  removeQueueAt: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  moveInQueue: (from, to) => set((s) => {
    const q = s.queue.slice()
    const [item] = q.splice(from, 1)
    if (!item) return {}
    q.splice(to, 0, item)
    return { queue: q }
  }),
  clearQueue: () => set({ queue: [] }),

  /**
   * Forget tracks that no longer exist in the library. If the song on the
   * platter was one of them, playback stops cleanly instead of leaving audio
   * running behind an empty transport.
   */
  dropRemoved: (ids) => {
    const st = get()
    const gone = new Set(ids)
    const queue = st.queue.filter((q) => !gone.has(q.songId))
    const context = st.context.filter((id) => !gone.has(id))
    if (st.songId && gone.has(st.songId)) {
      audio.pause()
      set({ queue, context, songId: null, isPlaying: false, position: 0, duration: 0, vinylOutFor: null })
      return
    }
    set({ queue, context })
  },

  setVinylOut: (albumId) => set({ vinylOutFor: albumId }),
  setPlaying: (v) => set({ isPlaying: v }),
}))

// Convenience typed hook for the currently playing song
export function selectCurrentSong(): Song | undefined {
  const id = usePlayerStore.getState().songId
  return id ? useLibraryStore.getState().getSong(id) : undefined
}
