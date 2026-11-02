import { create } from 'zustand'

import { createStorage } from './storage'
import type { AppData, AppTab } from './types'

const storage = createStorage()

const defaultAppData = (): AppData => ({
  schemaVersion: 1,
  subjects: [
    { id: 'math', name: 'Math', color: '#7c3aed', archived: false },
    { id: 'science', name: 'Science', color: '#0ea5e9', archived: false },
    { id: 'reading', name: 'Reading', color: '#22c55e', archived: false },
    { id: 'history', name: 'History', color: '#f97316', archived: false },
    { id: 'language', name: 'Language', color: '#ef4444', archived: false },
  ],
  blocks: [],
  sessions: [],
  settings: {
    dayStart: '08:00',
    dailyTargetMinutes: 240,
    presets: [
      { focus: 25, break: 5 },
      { focus: 50, break: 10 },
      { focus: 90, break: 15 },
    ],
    defaultPreset: 0,
    themeMode: 'system',
  },
  timer: {
    status: 'idle',
    blockId: null,
    preset: { focus: 25, break: 5 },
    phase: 'focus',
  },
})

type AppStoreState = {
  activeTab: AppTab
  data: AppData
  hydrated: boolean
  setActiveTab: (tab: AppTab) => void
  updateData: (updater: (draft: AppData) => AppData) => void
  loadFromStorage: () => Promise<void>
}

export const useAppStore = create<AppStoreState>()((set) => ({
  activeTab: 'home',
  data: defaultAppData(),
  hydrated: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateData: (updater) => set((state) => ({ data: updater(state.data) })),
  loadFromStorage: async () => {
    const loaded = await storage.load()
    set({
      data: loaded ?? defaultAppData(),
      hydrated: true,
    })
  },
}))

useAppStore.subscribe((state) => {
  if (!state.hydrated) {
    return
  }

  void storage.save(state.data)
})

export { defaultAppData }
