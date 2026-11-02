import { MIN_DURATION, STEP } from './config'

export function roundDuration(min: number): number {
  if (min <= 0) {
    return 0
  }

  return Math.max(MIN_DURATION, Math.round(min / STEP) * STEP)
}
