import { MIN_DURATION } from './config'
import { roundDuration } from './roundDuration'

type PomodoroPreset = { focus: number; break: number }
type PomodoroChunk = { focusMinutes: number; breakMinutes: number }

export function getPomodoroChunks(
  blockMinutes: number,
  preset: PomodoroPreset = { focus: 25, break: 5 },
): PomodoroChunk[] {
  if (blockMinutes <= 0) {
    return []
  }

  const roundedBlock = roundDuration(blockMinutes)
  const chunks: PomodoroChunk[] = []
  let remaining = roundedBlock

  while (remaining > 0) {
    let focusMinutes = Math.min(preset.focus, remaining)
    const leftover = remaining - focusMinutes

    if (leftover > 0 && leftover < MIN_DURATION) {
      focusMinutes = remaining
    }

    const breakMinutes = remaining === focusMinutes ? 0 : preset.break
    chunks.push({ focusMinutes, breakMinutes })
    remaining -= focusMinutes
  }

  return chunks
}

export function getPomodoroPlan(
  blockMinutes: number,
  preset: PomodoroPreset = { focus: 25, break: 5 },
): PomodoroChunk {
  const chunks = getPomodoroChunks(blockMinutes, preset)
  return chunks[0] ?? { focusMinutes: 0, breakMinutes: 0 }
}
