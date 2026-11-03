import { describe, expect, it } from 'vitest'

import type { Block } from '../types'
import { overlapsExisting } from './overlapsExisting'

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

describe('overlapsExisting', () => {
  it('returns true when candidate overlaps an existing block', () => {
    const blocks = [mkBlock('a', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')]
    expect(overlapsExisting({ start: '2024-01-10T10:20:00.000Z', end: '2024-01-10T10:40:00.000Z' }, blocks)).toBe(true)
  })

  it('returns false when candidate only touches an edge', () => {
    const blocks = [mkBlock('a', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')]
    expect(overlapsExisting({ start: '2024-01-10T10:30:00.000Z', end: '2024-01-10T10:45:00.000Z' }, blocks)).toBe(false)
  })

  it('ignores the specified block id', () => {
    const blocks = [mkBlock('a', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')]
    expect(
      overlapsExisting(
        { start: '2024-01-10T10:05:00.000Z', end: '2024-01-10T10:25:00.000Z' },
        blocks,
        'a',
      ),
    ).toBe(false)
  })

  it('handles invalid candidate ranges as non-overlapping', () => {
    const blocks = [mkBlock('a', '2024-01-10T10:00:00.000Z', '2024-01-10T10:30:00.000Z')]
    expect(overlapsExisting({ start: '2024-01-10T10:30:00.000Z', end: '2024-01-10T10:30:00.000Z' }, blocks)).toBe(false)
  })
})
