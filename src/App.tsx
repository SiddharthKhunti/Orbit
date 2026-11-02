import { useEffect, useMemo } from 'react'

import CalendarTab from './components/CalendarTab'
import { useAppStore } from './store'
import type { AppTab } from './types'

const tabs: { key: AppTab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'pomodoro', label: 'Pomodoro' },
]

const tabCopy: Record<AppTab, { headline: string; body: string }> = {
  home: {
    headline: 'Welcome back to Orbit',
    body: 'Review your subjects, study rhythm, and daily momentum from one focused place.',
  },
  calendar: {
    headline: 'Calendar Workspace',
    body: 'Your planned blocks, make-up sessions, and day-by-day scheduling flow live here.',
  },
  pomodoro: {
    headline: 'Focus Timer',
    body: 'Run a structured session, track completed work, and carry the feedback loop forward.',
  },
}

type ThemeMode = 'system' | 'light' | 'dark'

const themeOptions: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') {
    return mode
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const activeTab = useAppStore((state) => state.activeTab)
  const data = useAppStore((state) => state.data)
  const loadFromStorage = useAppStore((state) => state.loadFromStorage)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const updateData = useAppStore((state) => state.updateData)
  const themeMode = data.settings.themeMode

  const resolvedTheme = useMemo(() => resolveTheme(themeMode), [themeMode])

  useEffect(() => {
    void loadFromStorage()
  }, [loadFromStorage])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    if (themeMode !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      document.documentElement.dataset.theme = mediaQuery.matches ? 'dark' : 'light'
    }

    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [themeMode])

  const setThemeMode = (nextMode: ThemeMode) => {
    updateData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        themeMode: nextMode,
      },
    }))
  }

  return (
    <div className="orbit-shell flex h-screen font-sans">
      <aside className="orbit-sidebar flex w-72 flex-col border-r p-5 backdrop-blur-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="orbit-logo-badge flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-semibold shadow-lg">
            O
          </div>
          <div>
            <p className="orbit-muted text-xs font-medium uppercase tracking-[0.2em]">Planner</p>
            <h1 className="logo-text text-xl font-semibold">Orbit</h1>
          </div>
        </div>

        <nav className="space-y-2">
          {tabs.map(({ key, label }) => {
            const isActive = key === activeTab

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={[
                  'orbit-tab-button flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-200',
                  isActive ? 'orbit-tab-button-active shadow-lg' : '',
                ].join(' ')}
              >
                <span>{label}</span>
                <span className="orbit-muted">›</span>
              </button>
            )
          })}
        </nav>

        <div className="orbit-card mt-auto rounded-2xl p-4 shadow-xl">
          <p className="orbit-muted text-[0.65rem] font-semibold uppercase tracking-[0.2em]">Theme</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setThemeMode(option.key)}
                className={[
                  'orbit-theme-option rounded-xl border px-2 py-1.5 text-xs font-semibold transition duration-200',
                  themeMode === option.key ? 'orbit-theme-option-active' : '',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="orbit-muted mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em]">State</p>
          <p className="mt-2 text-sm font-medium">Schema v{data.schemaVersion}</p>
          <p className="orbit-muted mt-1 text-xs">User data stored locally</p>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em]">{activeTab}</p>
            <h2 className="mt-2 text-3xl font-semibold">{tabCopy[activeTab].headline}</h2>
          </div>
          <div className="orbit-card timer-digits rounded-full border px-4 py-2 text-sm shadow-sm">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </header>

        {activeTab === 'calendar' ? (
          <CalendarTab />
        ) : (
          <section className="orbit-card rounded-[28px] border p-6">
            <p className="orbit-muted max-w-2xl text-base">{tabCopy[activeTab].body}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="orbit-card rounded-2xl border p-4">
                  <div className="orbit-action-button mb-3 h-2.5 w-16 rounded-full opacity-90" />
                  <div className="h-4 w-3/4 rounded-full bg-[color:var(--color-bg-hover)]" />
                  <div className="mt-3 h-4 w-1/2 rounded-full bg-[color:var(--color-bg-pressed)]" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
