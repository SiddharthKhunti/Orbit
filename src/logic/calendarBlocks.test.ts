import { describe, expect, it } from 'vitest'

import type { Block, Subject } from '../types'
import {
  createPlannedBlock,
  getDefaultSubject,
  hasMinimumBlockDuration,
  isTimeGridView,
  updateBlockTime,
} from './calendarBlocks'

describe('calendarBlocks', () => {
  it('identifies supported calendar views', () => {
    expect(isTimeGridView('timeGridWeek')).toBe(true)
    expect(isTimeGridView('timeGridDay')).toBe(true)
    expect(isTimeGridView('dayGridMonth')).toBe(false)
  })

  it('requires at least ten minutes for a block', () => {
    const start = new Date('2026-01-10T10:00:00.000Z')
    const shortEnd = new Date('2026-01-10T10:05:00.000Z')
    const validEnd = new Date('2026-01-10T10:10:00.000Z')

    expect(hasMinimumBlockDuration(start, shortEnd)).toBe(false)
    expect(hasMinimumBlockDuration(start, validEnd)).toBe(true)
  })

  it('returns the first non-archived subject as default', () => {
    const subjects: Subject[] = [
      { id: 'archived', name: 'Archived', color: '#000000', archived: true },
      { id: 'math', name: 'Math', color: '#7c3aed', archived: false },
    ]

    expect(getDefaultSubject(subjects)?.id).toBe('math')
    expect(getDefaultSubject([])).toBeNull()
  })

  it('creates and updates block times in ISO form', () => {
    const start = new Date('2026-01-10T11:00:00.000Z')
    const end = new Date('2026-01-10T11:30:00.000Z')
    const created = createPlannedBlock({
      id: 'block-1',
      subjectId: 'math',
      title: 'Math practice',
      start,
      end,
      manual: true,
    })

    expect(created.start).toBe('2026-01-10T11:00:00.000Z')
    expect(created.end).toBe('2026-01-10T11:30:00.000Z')
    expect(created.manual).toBe(true)

    const resized = updateBlockTime(
      created as Block,
      new Date('2026-01-10T11:05:00.000Z'),
      new Date('2026-01-10T11:45:00.000Z'),
    )

    expect(resized.start).toBe('2026-01-10T11:05:00.000Z')
    expect(resized.end).toBe('2026-01-10T11:45:00.000Z')
  })
})
