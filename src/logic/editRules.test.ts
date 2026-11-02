import { describe, expect, it } from 'vitest'

import type { Block } from '../types'
import { canSetBlockEnd, getBlockEditPolicy, isEditable } from './editRules'

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

  it('allows setting block end in the past when unlocked', () => {
    const now = new Date('2024-01-10T12:00:00Z')
    const past = mkBlock('b2', '2024-01-10T10:00:00Z', '2024-01-10T11:00:00Z')
    expect(canSetBlockEnd(past, '2024-01-10T11:30:00Z', now, true)).toBe(true)
  })
})
