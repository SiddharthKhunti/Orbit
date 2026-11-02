export const STEP = 5
export const MIN_DURATION = 10
export const PASS_RATING = 7
export const PENALTY_PCT: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.6,
  4: 0.4,
  5: 0.2,
  6: 0.1,
}
export const GAP_MAX_FRACTION = 0.25
export const END_OF_DAY_BUFFER_MIN = 15
export const DAY_END = '24:00'
export const AFTERNOON_WINDOW = { start: '12:00', end: '18:00' }

export const DEFAULT_SUBJECT_COLORS = ['#5b21b6', '#1d4ed8', '#0369a1', '#be123c', '#c2410c']
