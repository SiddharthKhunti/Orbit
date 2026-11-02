import { describe, expect, it } from 'vitest'

import type { Block } from '../types'
import {
  canFitMakeupInGap,
  getMakeupMinutesForRating,
  getMakeupRawMinutes,
  getStackedMakeupMinutes,
  placeMakeupBlock,
  upsertMakeupBlockForSession,
} from './makeup'
import { roundDuration } from './roundDuration'

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

describe('makeup math', () => {
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
})

describe('make-up gap placement', () => {
  it('checks gap fit thresholds', () => {
    expect(canFitMakeupInGap(10, 40)).toBe(true)
    expect(canFitMakeupInGap(15, 40)).toBe(false)
    expect(canFitMakeupInGap(15, 60)).toBe(true)
    expect(canFitMakeupInGap(20, 60)).toBe(false)
    expect(canFitMakeupInGap(30, 120)).toBe(true)
  })

  it('40-minute gap fits 10 but not 15', () => {
    expect(canFitMakeupInGap(10, 40)).toBe(true)
    expect(canFitMakeupInGap(15, 40)).toBe(false)
  })

  it('60-minute gap fits 15 but not 20', () => {
    expect(canFitMakeupInGap(15, 60)).toBe(true)
    expect(canFitMakeupInGap(20, 60)).toBe(false)
  })

  it('120-minute gap fits 30', () => {
    expect(canFitMakeupInGap(30, 120)).toBe(true)
  })

  it('never places make-up before now', () => {
    const now = new Date('2024-01-10T10:45:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00Z', '2024-01-10T10:30:00Z')
    const blocks = [sourceBlock, mkBlock('future-1', '2024-01-10T11:00:00Z', '2024-01-10T12:00:00Z')]

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
    const blocks = [sourceBlock, mkBlock('late-anchor', '2024-01-10T23:50:00Z', '2024-01-10T23:59:00Z')]

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

describe('make-up block creation and stacking', () => {
  it('creates a make-up block for a low rating', () => {
    const now = new Date('2024-01-10T10:45:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00Z', '2024-01-10T10:30:00Z')
    const blocks = [sourceBlock, mkBlock('future', '2024-01-10T11:00:00Z', '2024-01-10T12:00:00Z')]

    const result = upsertMakeupBlockForSession({
      blocks,
      sourceBlock,
      rating: 5,
      focusMinutes: 25,
      now,
      dayStart: '08:00',
      sessionId: 's1',
      createId: () => 'm1',
    })

    expect(result.action).toBe('created')
    if (result.action === 'none') {
      return
    }
    expect(result.block.id).toBe('m1')
    expect(result.block.kind).toBe('makeup')
  })

  it('stacks same subject and title on the same day and creates a separate block for a different title', () => {
    const now = new Date('2024-01-10T10:45:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00Z', '2024-01-10T10:30:00Z')
    const existing = {
      ...mkBlock('makeup-1', '2024-01-10T12:00:00Z', '2024-01-10T12:10:00Z', 'makeup'),
      makeupSourceSessionIds: ['s1'],
    }
    const blocks = [sourceBlock, existing, mkBlock('future', '2024-01-10T12:30:00Z', '2024-01-10T13:30:00Z')]

    const stacked = upsertMakeupBlockForSession({
      blocks,
      sourceBlock,
      rating: 6,
      focusMinutes: 50,
      now,
      dayStart: '08:00',
      sessionId: 's2',
      existingStackedRawMinutes: [5],
    })

    expect(stacked.action).toBe('stacked')
    if (stacked.action === 'none') {
      return
    }
    expect(stacked.block.id).toBe('makeup-1')
    expect(stacked.block.makeupSourceSessionIds).toEqual(['s1', 's2'])

    const differentTitleSource = {
      ...sourceBlock,
      id: 'source-2',
      title: 'Geometry',
    }
    const separate = upsertMakeupBlockForSession({
      blocks,
      sourceBlock: differentTitleSource,
      rating: 5,
      focusMinutes: 25,
      now,
      dayStart: '08:00',
      sessionId: 's3',
      createId: () => 'm2',
    })

    expect(separate.action).toBe('created')
    if (separate.action === 'none') {
      return
    }
    expect(separate.block.id).toBe('m2')
  })

  it('produces no make-up for ratings 7 through 10', () => {
    const now = new Date('2024-01-10T10:45:00Z')
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00Z', '2024-01-10T10:30:00Z')
    const blocks = [sourceBlock]
    const ratings = [7, 8, 9, 10]

    for (const rating of ratings) {
      const result = upsertMakeupBlockForSession({
        blocks,
        sourceBlock,
        rating,
        focusMinutes: 25,
        now,
        dayStart: '08:00',
        sessionId: `s-${rating}`,
      })
      expect(result.action).toBe('none')
      expect(result.makeupMinutes).toBe(0)
    }
  })
})
