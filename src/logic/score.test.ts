import { describe, expect, it } from 'vitest'

import { getAfternoonScore, getScore } from './score'

describe('score', () => {
  it('matches the weighted formula and stays bounded', () => {
    const sessions = [
      {
        id: 's1',
        blockId: 'b1',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T09:45:00Z',
        focusMinutes: 45,
        breakMinutes: 5,
        rating: 8,
        manual: false,
      },
      {
        id: 's2',
        blockId: 'b2',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-01T12:00:00Z',
        end: '2024-01-01T12:35:00Z',
        focusMinutes: 35,
        breakMinutes: 5,
        rating: 7,
        manual: false,
      },
    ]
    const blocks = [
      { id: 'b1', subjectId: 'math', title: 'Algebra', start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:00:00Z', kind: 'planned' as const },
      { id: 'b2', subjectId: 'math', title: 'Algebra', start: '2024-01-01T12:00:00Z', end: '2024-01-01T13:00:00Z', kind: 'planned' as const },
    ]

    const window = {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z',
    }
    const score = getScore(sessions, blocks, window)
    const avgRating = (8 + 7) / 2
    const completedRatio = 1
    const focusRatio = 80 / 240
    const expected = 100 * (0.5 * (avgRating / 10) + 0.3 * completedRatio + 0.2 * focusRatio)

    expect(score).toBeCloseTo(expected, 8)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThan(0)
  })

  it('supports afternoon efficiency using the afternoon window', () => {
    const sessions = [
      {
        id: 'morning',
        blockId: 'b1',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T09:25:00Z',
        focusMinutes: 25,
        breakMinutes: 5,
        rating: 10,
        manual: false,
      },
      {
        id: 'afternoon',
        blockId: 'b2',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-01T13:00:00Z',
        end: '2024-01-01T13:25:00Z',
        focusMinutes: 25,
        breakMinutes: 5,
        rating: 6,
        manual: false,
      },
    ]
    const blocks = [
      { id: 'b1', subjectId: 'math', title: 'Algebra', start: '2024-01-01T09:00:00Z', end: '2024-01-01T10:00:00Z', kind: 'planned' as const },
      { id: 'b2', subjectId: 'math', title: 'Algebra', start: '2024-01-01T13:00:00Z', end: '2024-01-01T14:00:00Z', kind: 'planned' as const },
    ]

    const afternoon = getAfternoonScore(sessions, blocks, '2024-01-01T00:00:00Z', 240)
    const wholeDay = getScore(sessions, blocks, {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z',
    })

    expect(afternoon).toBeLessThan(wholeDay)
  })
})
