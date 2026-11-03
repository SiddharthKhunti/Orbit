import { describe, expect, it } from 'vitest'

import type { Block, Session } from '../types'
import { applySessionFeedback } from './sessionFeedback'

function mkBlock(
  id: string,
  start: string,
  end: string,
  kind: 'planned' | 'makeup' = 'planned',
  title: string = 'Algebra',
): Block {
  return {
    id,
    subjectId: 'math',
    title,
    start,
    end,
    kind,
  }
}

function mkSession(id: string, blockId: string, rating: number, focusMinutes: number): Session {
  return {
    id,
    blockId,
    subjectId: 'math',
    title: 'Algebra',
    start: '2024-01-10T09:00:00.000Z',
    end: '2024-01-10T09:25:00.000Z',
    focusMinutes,
    breakMinutes: 5,
    rating,
    manual: false,
  }
}

describe('applySessionFeedback', () => {
  it('does not add make-up blocks for productive ratings', () => {
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')
    const result = applySessionFeedback({
      blocks: [sourceBlock],
      sessions: [],
      sourceBlock,
      rating: 8,
      focusMinutes: 25,
      breakMinutes: 5,
      startTs: Date.parse('2024-01-10T10:00:00.000Z'),
      endTs: Date.parse('2024-01-10T10:25:00.000Z'),
      dayStart: '08:00',
      createId: () => 'new-session',
    })

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.id).toBe('source')
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]?.rating).toBe(8)
  })

  it('stacks by raw minutes, then rounds once', () => {
    const sourceBlock = mkBlock('source', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')
    const existingMakeup: Block = {
      ...mkBlock('makeup-1', '2024-01-10T11:00:00.000Z', '2024-01-10T11:10:00.000Z', 'makeup'),
      makeupSourceSessionIds: ['s1', 's2'],
    }
    const blocks = [
      sourceBlock,
      mkBlock('left-anchor', '2024-01-10T10:30:00.000Z', '2024-01-10T11:00:00.000Z'),
      existingMakeup,
      mkBlock('right-anchor', '2024-01-10T12:00:00.000Z', '2024-01-10T12:30:00.000Z'),
    ]
    const sessions = [mkSession('s1', sourceBlock.id, 5, 25), mkSession('s2', sourceBlock.id, 5, 25)]

    const result = applySessionFeedback({
      blocks,
      sessions,
      sourceBlock,
      rating: 5,
      focusMinutes: 25,
      breakMinutes: 5,
      startTs: Date.parse('2024-01-10T10:30:00.000Z'),
      endTs: Date.parse('2024-01-10T10:55:00.000Z'),
      dayStart: '08:00',
      createId: () => 's3',
    })

    const updatedMakeup = result.blocks.find((block) => block.id === 'makeup-1')
    expect(updatedMakeup).toBeDefined()
    expect(updatedMakeup?.start).toBe('2024-01-10T11:00:00.000Z')
    expect(updatedMakeup?.end).toBe('2024-01-10T11:15:00.000Z')
    expect(updatedMakeup?.makeupSourceSessionIds).toEqual(['s1', 's2', 's3'])
  })
})
