import { create } from 'zustand'
import type { PublicUser } from '../types/models'
import * as auth from '../services/auth'
import { setUserScope } from '../services/storage'
import { applyTheme, DEFAULT_PALETTE } from '../lib/color'
import { useSettingsStore } from './settings'
import { useLibraryStore } from './library'
import { usePlayerStore } from './player'
import { useUiStore } from './ui'

interface AuthState {
  status: 'loading' | 'anon' | 'authed'
  user: PublicUser | null
  init: () => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string, remember: boolean) => Promise<void>
  logout: () => void
}

async function enterSession(user: PublicUser) {
  setUserScope(user.id)
  useSettingsStore.getState().hydrate(user.id)
  await useLibraryStore.getState().hydrate(user.id)
  usePlayerStore.getState().onSession()
  useUiStore.getState().resetToHome()
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  init: async () => {
    const session = auth.readSession()
    if (!session) { set({ status: 'anon', user: null }); return }
    const user = auth.listUsers().find((u) => u.id === session.uid)
    if (!user) { auth.logout(); set({ status: 'anon', user: null }); return }
    await enterSession(user)
    set({ status: 'authed', user })
  },

  register: async (name, email, password) => {
    const user = await auth.register(name, email, password)
    await enterSession(user)
    set({ status: 'authed', user })
  },

  login: async (email, password, remember) => {
    const { user } = await auth.login(email, password, remember)
    await enterSession(user)
    set({ status: 'authed', user })
  },

  logout: () => {
    auth.logout()
    usePlayerStore.getState().stopAll()
    setUserScope(null)
    useLibraryStore.getState().clearInMemory()
    applyTheme(DEFAULT_PALETTE)
    set({ status: 'anon', user: null })
  },
}))
