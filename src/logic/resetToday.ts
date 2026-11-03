import type { Block, Session } from '../types'

type DayRange = { start: number; end: number }

function getLocalDayRange(reference: Date): DayRange {
  const dayStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 0, 0, 0, 0).getTime()
  return {
    start: dayStart,
    end: dayStart + 24 * 60 * 60 * 1000,
  }
}

function overlapsDay(startIso: string, endIso: string, dayRange: DayRange): boolean {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false
  }

  return start < dayRange.end && end > dayRange.start
}

export function clearTodayBlocksAndSessions(
  blocks: Block[],
  sessions: Session[],
  today: Date = new Date(),
): { blocks: Block[]; sessions: Session[] } {
  const dayRange = getLocalDayRange(today)
  return {
    blocks: blocks.filter((block) => !overlapsDay(block.start, block.end, dayRange)),
    sessions: sessions.filter((session) => !overlapsDay(session.start, session.end, dayRange)),
  }
}
