import { describe, expect, it } from 'vitest'

import { getMakeupMinutesForRating, getPomodoroPlan, isEditable, roundDuration } from './roundDuration'

describe('roundDuration', () => {
  it('rounds to 5-minute steps with minimum of 10 minutes', () => {
    expect(roundDuration(4)).toBe(10)
    expect(roundDuration(7)).toBe(10)
    expect(roundDuration(12.67)).toBe(15)
    expect(roundDuration(22)).toBe(20)
    expect(roundDuration(23)).toBe(25)
  })
})

describe('makeup and pomodoro math', () => {
  it('calculates make-up minutes for lower ratings without increasing as ratings improve', () => {
    expect(getMakeupMinutesForRating(5, 25)).toBe(10)
    expect(getMakeupMinutesForRating(6, 25)).toBe(10)
    expect(getMakeupMinutesForRating(5, 50)).toBe(10)
    expect(getMakeupMinutesForRating(6, 90)).toBe(10)

    expect(getMakeupMinutesForRating(5, 25)).toBeGreaterThanOrEqual(getMakeupMinutesForRating(6, 25))
    expect(getMakeupMinutesForRating(5, 50)).toBeGreaterThanOrEqual(getMakeupMinutesForRating(6, 50))
  })

  it('uses a single focus block for short sessions', () => {
    expect(getPomodoroPlan(15)).toEqual({ focusMinutes: 15, breakMinutes: 0 })
    expect(getPomodoroPlan(10)).toEqual({ focusMinutes: 10, breakMinutes: 0 })
  })
})

describe('editable rule', () => {
  it('blocks past times unless unlocked', () => {
    const now = new Date('2024-01-10T12:00:00Z')
    expect(isEditable('2024-01-10T11:59:00Z', now, false)).toBe(false)
    expect(isEditable('2024-01-10T12:30:00Z', now, false)).toBe(true)
    expect(isEditable('2024-01-10T11:59:00Z', now, true)).toBe(true)
  })
})
