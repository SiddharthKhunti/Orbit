import { MIN_DURATION, PENALTY_PCT, STEP } from './config'

export function roundDuration(min: number): number {
  if (min <= 0) {
    return 0
  }

  return Math.max(MIN_DURATION, Math.round(min / STEP) * STEP)
}

export function getMakeupMinutesForRating(rating: number, focusMinutes: number): number {
  const penalty = PENALTY_PCT[rating]

  if (penalty === undefined || rating >= 7) {
    return 0
  }

  return roundDuration(focusMinutes * penalty)
}

export function getPomodoroPlan(blockMinutes: number, preset: { focus: number; break: number } = { focus: 25, break: 5 }): { focusMinutes: number; breakMinutes: number } {
  if (blockMinutes <= 0) {
    return { focusMinutes: 0, breakMinutes: 0 }
  }

  if (blockMinutes <= 10) {
    return { focusMinutes: blockMinutes, breakMinutes: 0 }
  }

  const roundedBlock = roundDuration(blockMinutes)

  if (roundedBlock <= preset.focus) {
    return { focusMinutes: roundedBlock, breakMinutes: 0 }
  }

  const focusMinutes = Math.min(preset.focus, roundedBlock)
  return { focusMinutes, breakMinutes: preset.break }
}

export function isEditable(time: string, now: Date, unlocked: boolean): boolean {
  if (unlocked) {
    return true
  }

  return new Date(time).getTime() >= now.getTime()
}
