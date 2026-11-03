import { PASS_RATING } from './config'
import type { Block, Session, Subject } from '../types'

type CalendarEventExtendedProps = {
  manual: boolean
  isMakeup: boolean
  isCompletedOverlay: boolean
}

export type CalendarEventModel = {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  classNames: string[]
  editable?: boolean
  extendedProps: CalendarEventExtendedProps
}

const COMPLETION_OVERLAY_COLOR_CANDIDATES = ['#10b981', '#22d3ee', '#facc15', '#f472b6']
const FALLBACK_COMPLETION_OVERLAY_COLOR = '#10b981'

function normalizeHex(color: string): string {
  return color.trim().toLowerCase()
}

export function getCompletionOverlayColor(subjects: Subject[]): string {
  const subjectColors = new Set(subjects.map((subject) => normalizeHex(subject.color)))
  for (const candidate of COMPLETION_OVERLAY_COLOR_CANDIDATES) {
    if (!subjectColors.has(normalizeHex(candidate))) {
      return candidate
    }
  }

  return FALLBACK_COMPLETION_OVERLAY_COLOR
}

export function buildCalendarEvents(blocks: Block[], sessions: Session[], subjects: Subject[]): CalendarEventModel[] {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const overlayColor = getCompletionOverlayColor(subjects)

  const blockEvents: CalendarEventModel[] = blocks.map((block) => {
    const blockColor = subjectById.get(block.subjectId)?.color ?? 'var(--color-accent)'
    return {
      id: block.id,
      title: block.title,
      start: block.start,
      end: block.end,
      backgroundColor: blockColor,
      borderColor: blockColor,
      classNames: ['orbit-calendar-event'],
      extendedProps: {
        manual: block.manual ?? false,
        isMakeup: block.kind === 'makeup',
        isCompletedOverlay: false,
      },
    }
  })

  const completionOverlays: CalendarEventModel[] = sessions
    .filter((session) => session.rating >= PASS_RATING)
    .filter((session) => blockById.has(session.blockId))
    .map((session) => ({
      id: `completed-overlay-${session.id}`,
      title: 'Completed! 🎉',
      start: session.start,
      end: session.end,
      backgroundColor: overlayColor,
      borderColor: overlayColor,
      classNames: ['orbit-calendar-completed-overlay'],
      editable: false,
      extendedProps: {
        manual: false,
        isMakeup: false,
        isCompletedOverlay: true,
      },
    }))

  return [...blockEvents, ...completionOverlays]
}
