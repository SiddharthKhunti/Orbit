import { useEffect } from 'react'

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

function App() {
  const activeTab = useAppStore((state) => state.activeTab)
  const data = useAppStore((state) => state.data)
  const loadFromStorage = useAppStore((state) => state.loadFromStorage)
  const setActiveTab = useAppStore((state) => state.setActiveTab)

  useEffect(() => {
    void loadFromStorage()
  }, [loadFromStorage])

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <aside className="flex w-72 flex-col border-r border-slate-200 bg-white/80 p-5 backdrop-blur-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-lg font-semibold text-white shadow-lg shadow-violet-200">
            O
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Planner</p>
            <h1 className="text-xl font-semibold text-slate-900">Orbit</h1>
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
                  'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                ].join(' ')}
              >
                <span>{label}</span>
                <span className={isActive ? 'text-slate-300' : 'text-slate-400'}>›</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white shadow-xl shadow-slate-200">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">State</p>
          <p className="mt-2 text-sm text-slate-200">Schema v{data.schemaVersion}</p>
          <p className="mt-1 text-xs text-slate-400">User data stored locally</p>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">{activeTab}</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">{tabCopy[activeTab].headline}</h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80">
          <p className="max-w-2xl text-base text-slate-600">{tabCopy[activeTab].body}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 h-2.5 w-16 rounded-full bg-violet-200" />
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
