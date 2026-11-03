import { describe, expect, it } from 'vitest'

import type { Block, Session } from '../types'
import { clearTodayBlocksAndSessions } from './resetToday'

function mkBlock(id: string, start: string, end: string): Block {
  return {
    id,
    subjectId: 'math',
    title: 'Algebra',
    start,
    end,
    kind: 'planned',
  }
}

function mkSession(id: string, start: string, end: string): Session {
  return {
    id,
    blockId: 'source',
    subjectId: 'math',
    title: 'Algebra',
    start,
    end,
    focusMinutes: 25,
    breakMinutes: 5,
    rating: 8,
    manual: false,
  }
}

describe('clearTodayBlocksAndSessions', () => {
  it('clears only entries that overlap today', () => {
    const today = new Date('2024-01-10T12:00:00Z')
    const blocks = [
      mkBlock('before', '2024-01-09T09:00:00Z', '2024-01-09T10:00:00Z'),
      mkBlock('today', '2024-01-10T09:00:00Z', '2024-01-10T10:00:00Z'),
      mkBlock('after', '2024-01-11T09:00:00Z', '2024-01-11T10:00:00Z'),
    ]
    const sessions = [
      mkSession('s-before', '2024-01-09T09:00:00Z', '2024-01-09T09:25:00Z'),
      mkSession('s-today', '2024-01-10T09:00:00Z', '2024-01-10T09:25:00Z'),
      mkSession('s-after', '2024-01-11T09:00:00Z', '2024-01-11T09:25:00Z'),
    ]

    const result = clearTodayBlocksAndSessions(blocks, sessions, today)
    expect(result.blocks.map((block) => block.id)).toEqual(['before', 'after'])
    expect(result.sessions.map((session) => session.id)).toEqual(['s-before', 's-after'])
  })
})
