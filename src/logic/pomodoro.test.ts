import { describe, expect, it } from 'vitest'

import type { Block, TimerState } from '../types'
import {
  getCappedPomodoroPlan,
  getCurrentOrNextBlock,
  getPomodoroChunks,
  getPomodoroPlan,
  getTimerRemainingMs,
} from './pomodoro'

describe('pomodoro', () => {
  const sampleBlock: Block = {
    id: 'block-1',
    subjectId: 'math',
    title: 'Study block',
    start: '2026-11-02T15:00:00.000Z',
    end: '2026-11-02T16:00:00.000Z',
    kind: 'planned',
  }

  it('uses a single focus block for short sessions', () => {
    expect(getPomodoroPlan(15)).toEqual({ focusMinutes: 15, breakMinutes: 0 })
    expect(getPomodoroPlan(10)).toEqual({ focusMinutes: 10, breakMinutes: 0 })
    expect(getPomodoroChunks(15)).toEqual([{ focusMinutes: 15, breakMinutes: 0 }])
  })

  it('creates exactly one 15-minute pomodoro chunk', () => {
    expect(getPomodoroChunks(15)).toEqual([{ focusMinutes: 15, breakMinutes: 0 }])
  })

  it('creates a 10-minute focus with no break for a 10-minute block', () => {
    expect(getPomodoroPlan(10)).toEqual({ focusMinutes: 10, breakMinutes: 0 })
  })

  it('splits a 35-minute block with 25/5 into 25 then 10', () => {
    expect(getPomodoroChunks(35, { focus: 25, break: 5 })).toEqual([
      { focusMinutes: 25, breakMinutes: 5 },
      { focusMinutes: 10, breakMinutes: 0 },
    ])
  })

  it('folds a 28-minute block leftover into one chunk', () => {
    expect(getPomodoroChunks(28, { focus: 25, break: 5 })).toEqual([{ focusMinutes: 30, breakMinutes: 0 }])
  })

  it('returns the current block or the next upcoming block', () => {
    const nextBlock: Block = {
      id: 'block-2',
      subjectId: 'science',
      title: 'Next block',
      start: '2026-11-02T17:00:00.000Z',
      end: '2026-11-02T18:00:00.000Z',
      kind: 'planned',
    }

    expect(getCurrentOrNextBlock([nextBlock, sampleBlock], new Date('2026-11-02T15:30:00.000Z'))?.id).toBe(
      sampleBlock.id,
    )
    expect(getCurrentOrNextBlock([sampleBlock, nextBlock], new Date('2026-11-02T16:30:00.000Z'))?.id).toBe(
      nextBlock.id,
    )
    expect(getCurrentOrNextBlock([sampleBlock], new Date('2026-11-02T18:30:00.000Z'))).toBeNull()
  })

  it('caps focus plan to remaining block time', () => {
    const cappedPlan = getCappedPomodoroPlan(sampleBlock, new Date('2026-11-02T15:47:00.000Z'))
    expect(cappedPlan).toEqual({ focusMinutes: 13, breakMinutes: 0 })
  })

  it('computes remaining timer milliseconds from timestamps', () => {
    const runningTimer: TimerState = {
      status: 'running',
      blockId: 'block-1',
      preset: { focus: 25, break: 5 },
      phase: 'focus',
      endTimestamp: 5000,
      focusMinutes: 25,
      breakMinutes: 5,
    }
    const pausedTimer: TimerState = {
      status: 'paused',
      blockId: 'block-1',
      preset: { focus: 25, break: 5 },
      phase: 'focus',
      remainingMs: 3000,
      focusMinutes: 25,
      breakMinutes: 5,
    }

    expect(getTimerRemainingMs(runningTimer, 2000)).toBe(3000)
    expect(getTimerRemainingMs(runningTimer, 7000)).toBe(0)
    expect(getTimerRemainingMs(pausedTimer, 2000)).toBe(3000)
  })
})
