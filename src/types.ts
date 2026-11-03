export type Subject = {
  id: string
  name: string
  color: string
  archived: boolean
}

export type Block = {
  id: string
  subjectId: string
  title: string
  start: string
  end: string
  kind: 'planned' | 'makeup'
  makeupSourceSessionIds?: string[]
  manual?: boolean
}

export type Session = {
  id: string
  blockId: string
  subjectId: string
  title: string
  start: string
  end: string
  focusMinutes: number
  breakMinutes: number
  rating: number
  manual: boolean
}

export type TimerState = {
  status: 'idle' | 'running' | 'paused'
  blockId: string | null
  preset: { focus: number; break: number }
  phase: 'focus' | 'break'
  focusMinutes: number
  breakMinutes: number
  endTimestamp?: number
  remainingMs?: number
  focusStartedAt?: number
  focusCompletedAt?: number
  awaitingRating?: boolean
}

export type Settings = {
  dayStart: string
  dailyTargetMinutes: number
  presets: { focus: number; break: number }[]
  defaultPreset: number
  themeMode: 'system' | 'light' | 'dark'
}

export type AppData = {
  schemaVersion: 1
  subjects: Subject[]
  blocks: Block[]
  sessions: Session[]
  settings: Settings
  timer: TimerState
}

export type AppTab = 'home' | 'calendar' | 'pomodoro'
