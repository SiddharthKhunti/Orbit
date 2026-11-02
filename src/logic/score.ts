import type { Block, Session } from '../types'

const SCORE_WEIGHTS = {
  rating: 0.5,
  completed: 0.3,
  focus: 0.2,
} as const

export type ScoreWindow = { start: number | string; end: number | string }

function normalizeWindow(window?: ScoreWindow): { start: number; end: number } | undefined {
  if (!window) {
    return undefined
  }

  const start = new Date(window.start).getTime()
  const end = new Date(window.end).getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return undefined
  }

  return { start, end }
}

function isInWindow(value: string, window?: { start: number; end: number }): boolean {
  if (!window) {
    return true
  }

  const timestamp = new Date(value).getTime()
  return timestamp >= window.start && timestamp <= window.end
}

function sumMinutes(blocks: Block[]): number {
  return blocks.reduce((total, block) => {
    const start = new Date(block.start).getTime()
    const end = new Date(block.end).getTime()
    const duration = end - start

    if (Number.isNaN(duration)) {
      return total
    }

    return total + Math.max(0, duration / 60000)
  }, 0)
}

export function getScore(
  sessions: Session[],
  blocks: Block[],
  window?: ScoreWindow,
  dailyTargetMinutes = 240,
): number {
  const normalizedWindow = normalizeWindow(window)
  const filteredSessions = sessions.filter((session) => isInWindow(session.start, normalizedWindow))
  const filteredBlocks = blocks.filter((block) => isInWindow(block.start, normalizedWindow))

  const avgRating = filteredSessions.length
    ? filteredSessions.reduce((total, session) => total + session.rating, 0) / filteredSessions.length
    : 0

  const focusMinutes = filteredSessions.reduce((total, session) => total + session.focusMinutes, 0)
  const plannedMinutes = sumMinutes(filteredBlocks)
  const completedRatio = plannedMinutes > 0 ? Math.min(1, focusMinutes / plannedMinutes) : 0
  const focusRatio = Math.min(1, focusMinutes / Math.max(dailyTargetMinutes, 1))

  const score =
    100 *
    (SCORE_WEIGHTS.rating * (avgRating / 10) +
      SCORE_WEIGHTS.completed * completedRatio +
      SCORE_WEIGHTS.focus * focusRatio)

  return Math.min(100, Math.max(0, score))
}
