import type { Block, TimerState } from '../types'
import { MIN_DURATION } from './config'
import { roundDuration } from './roundDuration'

export type PomodoroPreset = { focus: number; break: number }
export type PomodoroChunk = { focusMinutes: number; breakMinutes: number }

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

export function getCurrentOrNextBlock(blocks: Block[], now: Date): Block | null {
  const nowTs = now.getTime()
  const sortedBlocks = [...blocks].sort((left, right) => {
    return new Date(left.start).getTime() - new Date(right.start).getTime()
  })

  for (const block of sortedBlocks) {
    const startTs = new Date(block.start).getTime()
    const endTs = new Date(block.end).getTime()
    if (startTs <= nowTs && nowTs < endTs) {
      return block
    }
  }

  for (const block of sortedBlocks) {
    const startTs = new Date(block.start).getTime()
    if (startTs > nowTs) {
      return block
    }
  }

  return null
}

export function getRemainingBlockMinutes(block: Block, now: Date): number {
  const nowTs = now.getTime()
  const blockStartTs = new Date(block.start).getTime()
  const blockEndTs = new Date(block.end).getTime()
  const activeStartTs = Math.max(nowTs, blockStartTs)
  const remainingMinutes = (blockEndTs - activeStartTs) / 60_000
  return Math.max(0, remainingMinutes)
}

export function getCappedPomodoroPlan(
  block: Block,
  now: Date,
  preset: PomodoroPreset = { focus: 25, break: 5 },
): PomodoroChunk {
  const remainingBlockMinutes = getRemainingBlockMinutes(block, now)
  if (remainingBlockMinutes <= 0) {
    return { focusMinutes: 0, breakMinutes: 0 }
  }

  const roundedPlan = getPomodoroPlan(remainingBlockMinutes, preset)
  let focusMinutes = Math.min(remainingBlockMinutes, roundedPlan.focusMinutes)
  if (remainingBlockMinutes - focusMinutes > 0 && remainingBlockMinutes - focusMinutes < MIN_DURATION) {
    focusMinutes = remainingBlockMinutes
  }

  const breakMinutes = focusMinutes >= remainingBlockMinutes ? 0 : roundedPlan.breakMinutes
  return { focusMinutes, breakMinutes }
}

export function getTimerRemainingMs(timer: TimerState, nowMs: number): number {
  if (timer.status === 'running' && timer.endTimestamp) {
    return Math.max(0, timer.endTimestamp - nowMs)
  }

  if (timer.status === 'paused') {
    return Math.max(0, timer.remainingMs ?? 0)
  }

  return 0
}
