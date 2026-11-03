import { getMakeupRawMinutes, upsertMakeupBlockForSession } from './makeup'
import type { Block, Session } from '../types'

type ApplySessionFeedbackInput = {
  blocks: Block[]
  sessions: Session[]
  sourceBlock: Block
  rating: number
  focusMinutes: number
  breakMinutes: number
  startTs: number
  endTs: number
  dayStart: string
  createId?: () => string
}

type ApplySessionFeedbackResult = {
  blocks: Block[]
  sessions: Session[]
  addedSession: Session
}

function parseTime(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0
  }
  return hours * 60 + minutes
}

function isSameStudyDay(candidateIso: string, referenceIso: string, dayStart: string): boolean {
  const reference = new Date(referenceIso)
  const startMinutes = parseTime(dayStart)
  const midnightTs = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0)
  const dayStartTs = midnightTs + startMinutes * 60_000
  const dayEndTs = midnightTs + 24 * 60 * 60_000
  const candidateTs = new Date(candidateIso).getTime()
  return candidateTs >= dayStartTs && candidateTs < dayEndTs
}

export function applySessionFeedback({
  blocks,
  sessions,
  sourceBlock,
  rating,
  focusMinutes,
  breakMinutes,
  startTs,
  endTs,
  dayStart,
  createId,
}: ApplySessionFeedbackInput): ApplySessionFeedbackResult {
  const newSession: Session = {
    id: createId?.() ?? crypto.randomUUID(),
    blockId: sourceBlock.id,
    subjectId: sourceBlock.subjectId,
    title: sourceBlock.title,
    start: new Date(startTs).toISOString(),
    end: new Date(endTs).toISOString(),
    focusMinutes,
    breakMinutes,
    rating,
    manual: false,
  }

  const nextSessions = [...sessions, newSession]
  const stackableMakeup = blocks.find(
    (block) =>
      block.kind === 'makeup' &&
      block.subjectId === sourceBlock.subjectId &&
      block.title === sourceBlock.title &&
      isSameStudyDay(block.start, sourceBlock.start, dayStart),
  )

  const existingStackedRawMinutes = stackableMakeup
    ? (stackableMakeup.makeupSourceSessionIds ?? [])
        .map((sourceSessionId) => nextSessions.find((session) => session.id === sourceSessionId))
        .filter((session): session is Session => Boolean(session))
        .map((session) => getMakeupRawMinutes(session.rating, session.focusMinutes))
    : undefined

  const finalizedMakeupUpdate = upsertMakeupBlockForSession({
    blocks,
    sourceBlock,
    rating,
    focusMinutes,
    now: new Date(endTs),
    dayStart,
    sessionId: newSession.id,
    existingStackedRawMinutes,
    createId,
  })

  if (finalizedMakeupUpdate.action === 'none') {
    return {
      blocks,
      sessions: nextSessions,
      addedSession: newSession,
    }
  }

  if (finalizedMakeupUpdate.action === 'stacked') {
    return {
      blocks: blocks.map((block) => (block.id === finalizedMakeupUpdate.block.id ? finalizedMakeupUpdate.block : block)),
      sessions: nextSessions,
      addedSession: newSession,
    }
  }

  return {
    blocks: [...blocks, finalizedMakeupUpdate.block],
    sessions: nextSessions,
    addedSession: newSession,
  }
}
