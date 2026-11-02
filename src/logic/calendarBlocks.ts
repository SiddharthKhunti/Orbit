import { MIN_DURATION } from './config'
import type { Block, Subject } from '../types'

export function isTimeGridView(viewType: string): boolean {
  return viewType === 'timeGridWeek' || viewType === 'timeGridDay'
}

export function hasMinimumBlockDuration(
  start: Date,
  end: Date,
  minDurationMinutes: number = MIN_DURATION,
): boolean {
  return end.getTime() - start.getTime() >= minDurationMinutes * 60_000
}

export function getDefaultSubject(subjects: Subject[]): Subject | null {
  return subjects.find((subject) => !subject.archived) ?? null
}

type NewBlockInput = {
  id: string
  subjectId: string
  title: string
  start: Date
  end: Date
}

export function createPlannedBlock(input: NewBlockInput): Block {
  return {
    id: input.id,
    subjectId: input.subjectId,
    title: input.title,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    kind: 'planned',
  }
}

export function updateBlockTime(block: Block, start: Date, end: Date): Block {
  return {
    ...block,
    start: start.toISOString(),
    end: end.toISOString(),
  }
}
