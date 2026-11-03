import { describe, expect, it } from 'vitest'

import type { Block, Session, Subject } from '../types'
import { buildCalendarEvents } from './calendarEvents'

describe('buildCalendarEvents', () => {
  it('adds completion overlays from productive sessions without splitting blocks', () => {
    const subjects: Subject[] = [{ id: 'math', name: 'Math', color: '#5b21b6', archived: false }]
    const blocks: Block[] = [
      {
        id: 'b1',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-10T10:00:00.000Z',
        end: '2024-01-10T11:00:00.000Z',
        kind: 'planned',
      },
    ]
    const sessions: Session[] = [
      {
        id: 's1',
        blockId: 'b1',
        subjectId: 'math',
        title: 'Algebra',
        start: '2024-01-10T10:05:00.000Z',
        end: '2024-01-10T10:30:00.000Z',
        focusMinutes: 25,
        breakMinutes: 5,
        rating: 8,
        manual: false,
      },
    ]

    const events = buildCalendarEvents(blocks, sessions, subjects)
    expect(events).toHaveLength(2)

    const blockEvent = events.find((event) => event.id === 'b1')
    expect(blockEvent?.extendedProps.isCompletedOverlay).toBe(false)

    const overlay = events.find((event) => event.id === 'completed-overlay-s1')
    expect(overlay?.title).toBe('Completed! 🎉')
    expect(overlay?.start).toBe('2024-01-10T10:05:00.000Z')
    expect(overlay?.end).toBe('2024-01-10T10:30:00.000Z')
    expect(overlay?.backgroundColor).not.toBe('#5b21b6')
    expect(overlay?.extendedProps.isCompletedOverlay).toBe(true)
  })
})
