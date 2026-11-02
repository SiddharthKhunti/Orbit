import type { Block, Session } from '../types'
import { AFTERNOON_WINDOW } from './config'

export const SCORE_WEIGHT_RATING = 0.5
export const SCORE_WEIGHT_COMPLETION = 0.3
export const SCORE_WEIGHT_FOCUS = 0.2

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

function toWindowForDay(referenceIso: string, window: { start: string; end: string }): ScoreWindow {
  const reference = new Date(referenceIso)
  const [startHour, startMinute] = window.start.split(':').map(Number)
  const [endHour, endMinute] = window.end.split(':').map(Number)
  const start = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), startHour, startMinute)
  const end = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), endHour, endMinute)
  return { start, end }
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
  const completedCount = filteredSessions.length
  const plannedCount = filteredBlocks.length
  const completedRatio = plannedCount > 0 ? Math.min(1, completedCount / plannedCount) : 0
  const focusRatio = Math.min(1, focusMinutes / Math.max(dailyTargetMinutes, 1))

  const score =
    100 *
    (SCORE_WEIGHT_RATING * (avgRating / 10) +
      SCORE_WEIGHT_COMPLETION * completedRatio +
      SCORE_WEIGHT_FOCUS * focusRatio)

  return Math.min(100, Math.max(0, score))
}

export function getAfternoonScore(
  sessions: Session[],
  blocks: Block[],
  referenceIso: string,
  dailyTargetMinutes = 240,
): number {
  const window = toWindowForDay(referenceIso, AFTERNOON_WINDOW)
  return getScore(sessions, blocks, window, dailyTargetMinutes)
}
