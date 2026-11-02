import { describe, expect, it } from 'vitest'

import { getScore } from './score'

describe('score', () => {
  it('returns a bounded score for a sample day', () => {
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

    const score = getScore(sessions, blocks, {
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T23:59:59Z',
    })

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
