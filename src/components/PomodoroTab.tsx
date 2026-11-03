import { useEffect, useMemo, useRef, useState } from 'react'

import { POMODORO_UI_TICK_MS } from '../logic/config'
import {
  getCappedPomodoroPlan,
  getCurrentOrNextBlock,
  getRemainingBlockMinutes,
  getTimerRemainingMs,
  type PomodoroPreset,
} from '../logic/pomodoro'
import { applySessionFeedback } from '../logic/sessionFeedback'
import { useAppStore } from '../store'
import type { Block, TimerState } from '../types'

type PomodoroTabProps = {
  isActive: boolean
}

function toDurationLabel(totalMs: number): string[] {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const digits = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return digits.split('')
}

function buildIdleTimer(preset: PomodoroPreset): TimerState {
  return {
    status: 'idle',
    blockId: null,
    preset,
    phase: 'focus',
    focusMinutes: 0,
    breakMinutes: 0,
    awaitingRating: false,
  }
}

function buildPausedFocusTimer(block: Block, now: Date, preset: PomodoroPreset): TimerState {
  const plan = getCappedPomodoroPlan(block, now, preset)
  if (plan.focusMinutes <= 0) {
    return buildIdleTimer(preset)
  }

  return {
    status: 'paused',
    blockId: block.id,
    preset,
    phase: 'focus',
    focusMinutes: plan.focusMinutes,
    breakMinutes: plan.breakMinutes,
    remainingMs: plan.focusMinutes * 60_000,
    awaitingRating: false,
  }
}

function playCompletionSound(): void {
  const audioContext = new window.AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gainNode.gain.value = 0.06
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.start()
  oscillator.stop(audioContext.currentTime + 0.25)
  oscillator.onended = () => {
    void audioContext.close()
  }
}

function notifyFocusComplete(title: string): void {
  if (!('Notification' in window)) {
    return
  }

  if (Notification.permission === 'granted') {
    new Notification('Focus session complete', {
      body: title,
    })
    return
  }

  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('Focus session complete', {
          body: title,
        })
      }
    })
  }
}

function PomodoroTab({ isActive }: PomodoroTabProps) {
  const hydrated = useAppStore((state) => state.hydrated)
  const data = useAppStore((state) => state.data)
  const updateData = useAppStore((state) => state.updateData)
  const [tickNowMs, setTickNowMs] = useState(() => Date.now())
  const [rating, setRating] = useState(7)
  const notifiedCompletionRef = useRef<number | null>(null)

  const blocks = data.blocks
  const subjects = data.subjects
  const timer = data.timer
  const presets = data.settings.presets

  const currentOrNextBlock = useMemo(() => getCurrentOrNextBlock(blocks, new Date(tickNowMs)), [blocks, tickNowMs])
  const activeBlock = useMemo(() => {
    if (!timer.blockId) {
      return currentOrNextBlock
    }
    return blocks.find((block) => block.id === timer.blockId) ?? currentOrNextBlock
  }, [blocks, currentOrNextBlock, timer.blockId])
  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === activeBlock?.subjectId) ?? null,
    [activeBlock?.subjectId, subjects],
  )

  const remainingMs = getTimerRemainingMs(timer, tickNowMs)
  const totalPhaseMs =
    timer.phase === 'focus' ? timer.focusMinutes * 60_000 : Math.max(timer.breakMinutes * 60_000, remainingMs)
  const progress = totalPhaseMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalPhaseMs)) : 0
  const ringCircumference = 2 * Math.PI * 138
  const ringOffset = ringCircumference * (1 - progress)

  useEffect(() => {
    if (!hydrated || timer.status !== 'running') {
      return
    }

    const timeout = window.setTimeout(() => {
      setTickNowMs(Date.now())
    }, POMODORO_UI_TICK_MS)

    return () => window.clearTimeout(timeout)
  }, [hydrated, timer.status, tickNowMs])

  useEffect(() => {
    if (!hydrated || timer.awaitingRating || timer.status !== 'running') {
      return
    }

    const nowMs = Date.now()
    const nextRemainingMs = getTimerRemainingMs(timer, nowMs)
    if (nextRemainingMs > 0) {
      return
    }

    const phaseEndTs = timer.endTimestamp ?? nowMs
    if (timer.phase === 'focus') {
      updateData((current) => ({
        ...current,
        timer: {
          ...current.timer,
          status: 'paused',
          endTimestamp: undefined,
          remainingMs: 0,
          focusCompletedAt: phaseEndTs,
          awaitingRating: true,
        },
      }))
      return
    }

    updateData((current) => ({
      ...current,
      timer: (() => {
        const currentBlockId = current.timer.blockId
        const sameBlock = currentBlockId ? current.blocks.find((block) => block.id === currentBlockId) : null
        const sourceBlock =
          sameBlock && getRemainingBlockMinutes(sameBlock, new Date(phaseEndTs)) > 0
            ? sameBlock
            : getCurrentOrNextBlock(current.blocks, new Date(phaseEndTs))

        return sourceBlock
          ? buildPausedFocusTimer(sourceBlock, new Date(phaseEndTs), current.timer.preset)
          : buildIdleTimer(current.timer.preset)
      })(),
    }))
  }, [hydrated, timer, updateData])

  useEffect(() => {
    if (!hydrated || !timer.awaitingRating) {
      return
    }

    const completionAt = timer.focusCompletedAt ?? null
    if (!completionAt || notifiedCompletionRef.current === completionAt) {
      return
    }

    notifiedCompletionRef.current = completionAt
    const title = activeBlock?.title ?? 'Time to review your session.'
    playCompletionSound()
    notifyFocusComplete(title)
  }, [activeBlock?.title, hydrated, timer.awaitingRating, timer.focusCompletedAt])

  useEffect(() => {
    if (!hydrated || timer.status !== 'idle' || timer.awaitingRating) {
      return
    }

    if (!currentOrNextBlock) {
      return
    }

    updateData((current) => ({
      ...current,
      timer: buildPausedFocusTimer(
        currentOrNextBlock,
        new Date(),
        current.settings.presets[current.settings.defaultPreset] ?? current.timer.preset,
      ),
    }))
  }, [currentOrNextBlock, hydrated, timer.awaitingRating, timer.status, updateData])

  const handlePresetChange = (preset: PomodoroPreset, presetIndex: number) => {
    updateData((current) => {
      const nextBlock = getCurrentOrNextBlock(current.blocks, new Date())
      const nextTimer = nextBlock ? buildPausedFocusTimer(nextBlock, new Date(), preset) : buildIdleTimer(preset)
      return {
        ...current,
        settings: {
          ...current.settings,
          defaultPreset: presetIndex,
        },
        timer: nextTimer,
      }
    })
  }

  const handlePauseResume = () => {
    if (!activeBlock || timer.awaitingRating) {
      return
    }

    const nowMs = Date.now()
    if (timer.status === 'running') {
      const nextRemainingMs = getTimerRemainingMs(timer, nowMs)
      updateData((current) => ({
        ...current,
        timer: {
          ...current.timer,
          status: 'paused',
          endTimestamp: undefined,
          remainingMs: nextRemainingMs,
        },
      }))
      return
    }

    updateData((current) => {
      const baseTimer =
        current.timer.blockId === activeBlock.id && current.timer.focusMinutes > 0
          ? current.timer
          : buildPausedFocusTimer(activeBlock, new Date(nowMs), current.timer.preset)
      const phaseDurationMs =
        baseTimer.phase === 'focus' ? baseTimer.focusMinutes * 60_000 : baseTimer.breakMinutes * 60_000
      const pausedMs = baseTimer.remainingMs ?? phaseDurationMs
      const nextRemainingMs = pausedMs > 0 ? pausedMs : phaseDurationMs

      const nextTimer: TimerState = {
        ...baseTimer,
        status: 'running',
        endTimestamp: nowMs + nextRemainingMs,
        remainingMs: undefined,
      }

      if (nextTimer.phase === 'focus' && !nextTimer.focusStartedAt) {
        nextTimer.focusStartedAt = nowMs
      }

      return {
        ...current,
        timer: nextTimer,
      }
    })
  }

  const handleSubmitRating = () => {
    if (!timer.awaitingRating || !activeBlock) {
      return
    }

    const completionTs = timer.focusCompletedAt ?? Date.now()
    const startedAtTs = timer.focusStartedAt ?? completionTs - timer.focusMinutes * 60_000
    const safeRating = Math.max(1, Math.min(10, rating))

    updateData((current) => {
      const block = current.blocks.find((item) => item.id === current.timer.blockId)
      if (!block) {
        return {
          ...current,
          timer: {
            ...current.timer,
            awaitingRating: false,
          },
        }
      }

      const feedback = applySessionFeedback({
        blocks: current.blocks,
        sessions: current.sessions,
        sourceBlock: block,
        rating: safeRating,
        focusMinutes: current.timer.focusMinutes,
        breakMinutes: current.timer.breakMinutes,
        startTs: startedAtTs,
        endTs: completionTs,
        dayStart: current.settings.dayStart,
      })

      if (current.timer.breakMinutes > 0) {
        return {
          ...current,
          blocks: feedback.blocks,
          sessions: feedback.sessions,
          timer: {
            ...current.timer,
            status: 'running',
            phase: 'break',
            endTimestamp: Date.now() + current.timer.breakMinutes * 60_000,
            remainingMs: undefined,
            focusStartedAt: undefined,
            focusCompletedAt: undefined,
            awaitingRating: false,
          },
        }
      }

      const nextBlock =
        getRemainingBlockMinutes(block, new Date()) > 0 ? block : getCurrentOrNextBlock(feedback.blocks, new Date())
      return {
        ...current,
        blocks: feedback.blocks,
        sessions: feedback.sessions,
        timer: nextBlock
          ? buildPausedFocusTimer(nextBlock, new Date(), current.timer.preset)
          : buildIdleTimer(current.timer.preset),
      }
    })
    setRating(7)
  }

  const activePresetLabel = `${timer.preset.focus}/${timer.preset.break}`
  const digits = toDurationLabel(remainingMs)
  const canControlTimer = Boolean(activeBlock) && !timer.awaitingRating
  const showDevJumpToCompletion = import.meta.env.DEV

  const handleDevJumpToFiveSeconds = () => {
    if (timer.awaitingRating || timer.status === 'idle') {
      return
    }

    const nowMs = Date.now()
    updateData((current) => {
      if (current.timer.awaitingRating || current.timer.status === 'idle') {
        return current
      }

      if (current.timer.status === 'running') {
        return {
          ...current,
          timer: {
            ...current.timer,
            endTimestamp: nowMs + 5_000,
            remainingMs: undefined,
          },
        }
      }

      return {
        ...current,
        timer: {
          ...current.timer,
          remainingMs: 5_000,
        },
      }
    })
  }

  return (
    <>
      {isActive ? (
        <section className="orbit-card rounded-[28px] border p-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {presets.map((preset, index) => {
              const value = `${preset.focus}/${preset.break}`
              const isSelected = value === activePresetLabel
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePresetChange(preset, index)}
                  className={[
                    'rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200',
                    isSelected ? 'orbit-theme-option-active' : 'orbit-theme-option',
                  ].join(' ')}
                >
                  {value}
                </button>
              )
            })}
          </div>

          {activeBlock ? (
            <>
              <div className="mt-6 flex justify-center">
                <div className="relative h-80 w-80">
                  <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
                    <circle
                      cx="160"
                      cy="160"
                      r="138"
                      className="fill-none stroke-[12] stroke-current text-[color:var(--color-bg-hover)]"
                    />
                    <circle
                      cx="160"
                      cy="160"
                      r="138"
                      className="fill-none stroke-[12] stroke-current text-[color:var(--color-accent)] transition-all duration-200"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="orbit-muted text-xs font-semibold uppercase tracking-[0.18em]">{timer.phase}</p>
                    <div className="flex items-center gap-2">
                      {digits.map((digit, index) =>
                        digit === ':' ? (
                          <span key={`colon-${index}`} className="text-3xl font-semibold">
                            :
                          </span>
                        ) : (
                          <span
                            key={`digit-${index}`}
                            className="timer-digit-box inline-flex h-12 w-9 items-center justify-center rounded-xl border text-3xl font-semibold"
                          >
                            {digit}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-lg font-semibold" style={{ color: activeSubject?.color }}>
                {activeBlock.title}
              </p>

              <div className="mt-6 flex justify-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    disabled={!canControlTimer}
                    className="orbit-action-button rounded-xl border px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {timer.status === 'running' ? 'Pause' : 'Resume'}
                  </button>
                  {showDevJumpToCompletion ? (
                    <button
                      type="button"
                      onClick={handleDevJumpToFiveSeconds}
                      disabled={!canControlTimer}
                      className="rounded-xl border px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Jump to 5s
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="mx-auto mt-10 max-w-xl rounded-2xl border p-8 text-center">
              <p className="text-lg font-semibold">No study blocks yet</p>
              <p className="orbit-muted mt-2 text-sm">Create a block in Calendar and your next Pomodoro will appear here.</p>
            </div>
          )}
        </section>
      ) : null}

      {timer.awaitingRating && activeBlock ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="orbit-card w-full max-w-sm rounded-2xl border p-5 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em]">Rate your focus</p>
            <p className="orbit-muted mt-2 text-sm">How productive was this session? (1 to 10)</p>
            <input
              type="number"
              min={1}
              max={10}
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              aria-label="Session rating"
              className="mt-4 w-full rounded-xl border px-3 py-2 text-base font-semibold"
            />
            <button
              type="button"
              onClick={handleSubmitRating}
              className="orbit-action-button mt-4 w-full rounded-xl border px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em]"
            >
              Submit rating
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default PomodoroTab
