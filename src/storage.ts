import type { AppData } from './types'

export interface Storage {
  load: () => Promise<AppData | null>
  save: (data: AppData) => Promise<void>
}

type ElectronBridge = {
  readAppData: () => Promise<string | null>
  writeAppData: (payload: string) => Promise<void>
}

export const DEFAULT_DATA_FILE = 'orbit-user-data.json'

const isElectronRuntime = (): boolean => !!(typeof window !== 'undefined' && 'electronAPI' in window && window.electronAPI)

export function migrateAppData(data: Partial<AppData> | null | undefined): AppData {
  const safeData = data ?? {}

  return {
    schemaVersion: 1,
    subjects: Array.isArray(safeData.subjects) ? safeData.subjects : [],
    blocks: Array.isArray(safeData.blocks) ? safeData.blocks : [],
    sessions: Array.isArray(safeData.sessions) ? safeData.sessions : [],
    settings: {
      dayStart: safeData.settings?.dayStart ?? '08:00',
      dailyTargetMinutes: safeData.settings?.dailyTargetMinutes ?? 240,
      presets: safeData.settings?.presets ?? [
        { focus: 25, break: 5 },
        { focus: 50, break: 10 },
        { focus: 90, break: 15 },
      ],
      defaultPreset: safeData.settings?.defaultPreset ?? 0,
      themeMode: safeData.settings?.themeMode ?? 'system',
    },
    timer: {
      status: safeData.timer?.status ?? 'idle',
      blockId: safeData.timer?.blockId ?? null,
      preset: {
        focus: safeData.timer?.preset?.focus ?? 25,
        break: safeData.timer?.preset?.break ?? 5,
      },
      phase: safeData.timer?.phase ?? 'focus',
      focusMinutes: safeData.timer?.focusMinutes ?? 0,
      breakMinutes: safeData.timer?.breakMinutes ?? 0,
      endTimestamp: safeData.timer?.endTimestamp,
      remainingMs: safeData.timer?.remainingMs,
      focusStartedAt: safeData.timer?.focusStartedAt,
      focusCompletedAt: safeData.timer?.focusCompletedAt,
      awaitingRating: safeData.timer?.awaitingRating ?? false,
    },
  }
}

class BrowserStorage implements Storage {
  readonly key = 'orbit.appData'

  async load(): Promise<AppData | null> {
    const raw = localStorage.getItem(this.key)
    if (!raw) {
      return null
    }

    try {
      return migrateAppData(JSON.parse(raw) as Partial<AppData>)
    } catch {
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data, null, 2))
  }
}

class ElectronFileStorage implements Storage {
  private readonly bridge: ElectronBridge

  constructor(bridge: ElectronBridge) {
    this.bridge = bridge
  }

  async load(): Promise<AppData | null> {
    const payload = await this.bridge.readAppData()
    if (!payload) {
      return null
    }

    try {
      const parsed = JSON.parse(payload) as Partial<AppData>
      return migrateAppData(parsed)
    } catch {
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    await this.bridge.writeAppData(JSON.stringify(data, null, 2))
  }
}

export function createStorage(): Storage {
  if (isElectronRuntime()) {
    return new ElectronFileStorage(window.electronAPI as ElectronBridge)
  }

  return new BrowserStorage()
}
