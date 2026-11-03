import { create } from 'zustand'

import { DEFAULT_SUBJECT_COLORS } from './logic/config'
import { createStorage } from './storage'
import type { AppData, AppTab } from './types'

const storage = createStorage()

const defaultAppData = (): AppData => ({
  schemaVersion: 1,
  subjects: [
    { id: 'math', name: 'Math', color: DEFAULT_SUBJECT_COLORS[0], archived: false },
    { id: 'science', name: 'Science', color: DEFAULT_SUBJECT_COLORS[1], archived: false },
    { id: 'reading', name: 'Reading', color: DEFAULT_SUBJECT_COLORS[2], archived: false },
    { id: 'history', name: 'History', color: DEFAULT_SUBJECT_COLORS[3], archived: false },
    { id: 'language', name: 'Language', color: DEFAULT_SUBJECT_COLORS[4], archived: false },
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
    focusMinutes: 0,
    breakMinutes: 0,
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
