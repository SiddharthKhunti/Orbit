import { describe, expect, it } from 'vitest'

import { getPomodoroChunks, getPomodoroPlan } from './pomodoro'

describe('pomodoro', () => {
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
})
