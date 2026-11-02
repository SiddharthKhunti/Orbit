import { describe, expect, it } from 'vitest'

import type { Block } from '../types'
import {
  canFitMakeupInGap,
  canSetBlockEnd,
  getBlockEditPolicy,
  getMakeupMinutesForRating,
  getMakeupRawMinutes,
  getPomodoroChunks,
  getPomodoroPlan,
  getStackedMakeupMinutes,
  isEditable,
  placeMakeupBlock,
  roundDuration,
} from './roundDuration'

function mkBlock(id: string, start: string, end: string, kind: 'planned' | 'makeup' = 'planned'): Block {
  return {
    id,
    subjectId: 'math',
    title: 'Algebra',
    start,
    end,
    kind,
  }
}

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
    expect(getMakeupMinutesForRating(6, 50)).toBe(10)
    expect(getMakeupMinutesForRating(5, 90)).toBe(20)
    expect(getMakeupMinutesForRating(6, 90)).toBe(10)

    expect(getMakeupMinutesForRating(5, 25)).toBeGreaterThanOrEqual(getMakeupMinutesForRating(6, 25))
    expect(getMakeupMinutesForRating(5, 50)).toBeGreaterThanOrEqual(getMakeupMinutesForRating(6, 50))
    expect(getMakeupMinutesForRating(5, 90)).toBeGreaterThanOrEqual(getMakeupMinutesForRating(6, 90))
  })

  it('stacks raw make-up first and rounds once', () => {
    const raw = [getMakeupRawMinutes(5, 25), getMakeupRawMinutes(5, 25), getMakeupRawMinutes(5, 25)]
    expect(raw).toEqual([5, 5, 5])
    expect(getStackedMakeupMinutes(raw)).toBe(15)
    expect(raw.map(roundDuration)).toEqual([10, 10, 10])
  })

  it('uses a single focus block for short sessions', () => {
    expect(getPomodoroPlan(15)).toEqual({ focusMinutes: 15, breakMinutes: 0 })
    expect(getPomodoroPlan(10)).toEqual({ focusMinutes: 10, breakMinutes: 0 })
    expect(getPomodoroChunks(15)).toEqual([{ focusMinutes: 15, breakMinutes: 0 }])
  })
})

describe('editable rule', () => {
  it('blocks past times unless unlocked', () => {
    const now = new Date('2024-01-10T12:00:00Z')
    expect(isEditable('2024-01-10T11:59:00Z', now, false)).toBe(false)
    expect(isEditable('2024-01-10T12:30:00Z', now, false)).toBe(true)
    expect(isEditable('2024-01-10T11:59:00Z', now, true)).toBe(true)
  })

  it('applies straddling block rules', () => {
    const now = new Date('2024-01-10T12:00:00Z')
    const straddling = mkBlock('b1', '2024-01-10T11:45:00Z', '2024-01-10T12:30:00Z')
    const policy = getBlockEditPolicy(straddling, now, false)

    expect(policy).toEqual({
      move: false,
      resizeStart: false,
      resizeEnd: true,
      delete: false,
      changeSubject: false,
      title: true,
    })
    expect(canSetBlockEnd(straddling, '2024-01-10T11:59:00Z', now, false)).toBe(false)
    expect(canSetBlockEnd(straddling, '2024-01-10T12:40:00Z', now, false)).toBe(true)
  })
})

describe('make-up gap placement', () => {
  it('checks gap fit thresholds', () => {
    expect(canFitMakeupInGap(10, 40)).toBe(true)
    expect(canFitMakeupInGap(15, 40)).toBe(false)
    expect(canFitMakeupInGap(15, 60)).toBe(true)
    expect(canFitMakeupInGap(20, 60)).toBe(false)
    expect(canFitMakeupInGap(30, 120)).toBe(true)
  })

  it('never places make-up before now', () => {
    const now = new Date('2024-01-10T10:45:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00Z', '2024-01-10T10:30:00Z')
    const blocks = [
      sourceBlock,
      mkBlock('future-1', '2024-01-10T11:00:00Z', '2024-01-10T12:00:00Z'),
    ]

    const placed = placeMakeupBlock({
      blocks,
      sourceBlock,
      now,
      dayStart: '08:00',
      makeupMinutes: 10,
    })

    expect(placed.start).toBe('2024-01-10T12:00:00.000Z')
    expect(placed.placement).toBe('gap')
  })

  it('moves a grown gap-placed block to end of day', () => {
    const now = new Date('2024-01-10T09:15:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T09:00:00Z', '2024-01-10T09:30:00Z')
    const existingMakeup = mkBlock('makeup', '2024-01-10T10:00:00Z', '2024-01-10T10:15:00Z', 'makeup')
    const blocks = [
      sourceBlock,
      existingMakeup,
      mkBlock('left-anchor', '2024-01-10T09:30:00Z', '2024-01-10T10:00:00Z'),
      mkBlock('right-anchor', '2024-01-10T11:00:00Z', '2024-01-10T11:30:00Z'),
    ]

    const moved = placeMakeupBlock({
      blocks,
      sourceBlock,
      now,
      dayStart: '08:00',
      makeupMinutes: 20,
      existingMakeupBlock: existingMakeup,
    })

    expect(moved.placement).toBe('end_of_day')
    expect(moved.start).toBe('2024-01-10T11:45:00.000Z')
    expect(moved.end).toBe('2024-01-10T12:05:00.000Z')
  })

  it('rolls over to the next day start after midnight', () => {
    const now = new Date('2024-01-10T23:50:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T23:10:00Z', '2024-01-10T23:40:00Z')
    const blocks = [
      sourceBlock,
      mkBlock('late-anchor', '2024-01-10T23:50:00Z', '2024-01-10T23:59:00Z'),
    ]

    const rollover = placeMakeupBlock({
      blocks,
      sourceBlock,
      now,
      dayStart: '08:00',
      makeupMinutes: 25,
    })

    expect(rollover.placement).toBe('next_day')
    expect(rollover.start).toBe('2024-01-11T08:00:00.000Z')
    expect(rollover.end).toBe('2024-01-11T08:25:00.000Z')
  })
})
