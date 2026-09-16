import { create } from 'zustand'
import type { Toast, ToastKind, ViewID, ViewParams, CtxItem } from '../types/models'

/** A liquid-glass confirmation request (replaces window.confirm). */
export interface ConfirmSpec {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Optional second, more destructive choice (e.g. delete the file on disk). */
  extra?: { label: string; hint?: string; onSelect: () => void }
  onConfirm: () => void
}

interface UiState {
  view: ViewID
  params: ViewParams
  backStack: Array<{ view: ViewID; params: ViewParams }>
  searchOpen: boolean
  rightTab: 'now' | 'lyrics' | 'queue'
  rightOpen: boolean
  nowPlayingOpen: boolean
  introDone: boolean
  /** sidebar rail collapses to icons on the reference layout */
  railCollapsed: boolean
  ctx: { x: number; y: number; items: CtxItem[] } | null
  toasts: Toast[]
  confirm: ConfirmSpec | null
  navigate: (view: ViewID, params?: ViewParams) => void
  back: () => void
  resetToHome: () => void
  setSearchOpen: (open: boolean) => void
  setRightTab: (tab: 'now' | 'lyrics' | 'queue') => void
  setRightOpen: (open: boolean) => void
  toggleNowPlaying: (open?: boolean) => void
  setIntroDone: (done: boolean) => void
  toggleRail: () => void
  openCtx: (x: number, y: number, items: CtxItem[]) => void
  closeCtx: () => void
  toast: (kind: ToastKind, message: string) => void
  dismissToast: (id: number) => void
  askConfirm: (spec: ConfirmSpec) => void
  closeConfirm: () => void
}

let toastId = 1

export const useUiStore = create<UiState>((set, get) => ({
  view: 'home',
  params: {},
  backStack: [],
  searchOpen: false,
  rightTab: 'now',
  rightOpen: true,
  nowPlayingOpen: false,
  introDone: false,
  railCollapsed: false,
  ctx: null,
  toasts: [],
  confirm: null,

  navigate: (view, params = {}) => {
    const cur = { view: get().view, params: get().params }
    set((s) => ({ view, params, backStack: [...s.backStack.slice(-24), cur], searchOpen: false }))
  },
  back: () => {
    const stack = get().backStack
    if (!stack.length) return
    const prev = stack[stack.length - 1]
    set({ view: prev.view, params: prev.params, backStack: stack.slice(0, -1) })
  },
  resetToHome: () => set({ view: 'home', params: {}, backStack: [], nowPlayingOpen: false, ctx: null, searchOpen: false, confirm: null }),

  setSearchOpen: (open) => set({ searchOpen: open }),
  setRightTab: (tab) => set({ rightTab: tab, rightOpen: true }),
  setRightOpen: (open) => set({ rightOpen: open }),
  toggleNowPlaying: (open) => set((s) => ({ nowPlayingOpen: open ?? !s.nowPlayingOpen })),
  setIntroDone: (done) => set({ introDone: done }),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  openCtx: (x, y, items) => set({ ctx: { x, y, items } }),
  closeCtx: () => set({ ctx: null }),
  toast: (kind, message) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }))
    setTimeout(() => get().dismissToast(id), 3600)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  askConfirm: (spec) => set({ confirm: spec, ctx: null }),
  closeConfirm: () => set({ confirm: null }),
}))

export function toast(kind: ToastKind, message: string) { useUiStore.getState().toast(kind, message) }

/** Open the liquid-glass confirmation dialog. */
export function askConfirm(spec: ConfirmSpec) { useUiStore.getState().askConfirm(spec) }
