import { DAY_END, END_OF_DAY_BUFFER_MIN, GAP_MAX_FRACTION, MIN_DURATION, PASS_RATING, PENALTY_PCT, STEP } from './config'
import type { Block } from '../types'

const MINUTES_PER_DAY = 24 * 60

type PomodoroPreset = { focus: number; break: number }
type PomodoroChunk = { focusMinutes: number; breakMinutes: number }
type EditableBlockAction = 'move' | 'resizeStart' | 'resizeEnd' | 'delete' | 'changeSubject' | 'title'
type EditableBlockPolicy = Record<EditableBlockAction, boolean>
type MakeupPlacement = 'gap' | 'end_of_day' | 'next_day'
type Gap = { start: number; end: number; sizeMinutes: number }
type TimeRange = { start: number; end: number }

type PlaceMakeupBlockInput = {
  blocks: Block[]
  sourceBlock: Block
  now: Date
  dayStart: string
  makeupMinutes: number
  existingMakeupBlock?: Block
}

type PlaceMakeupBlockResult = {
  start: string
  end: string
  placement: MakeupPlacement
}

export function roundDuration(min: number): number {
  if (min <= 0) {
    return 0
  }

  return Math.max(MIN_DURATION, Math.round(min / STEP) * STEP)
}

function parseIso(value: string): number {
  return new Date(value).getTime()
}

function toIso(ts: number): string {
  return new Date(ts).toISOString()
}

function toUtcDayBounds(referenceIso: string, dayStart: string): { dayStartTs: number; dayEndTs: number } {
  const reference = new Date(referenceIso)
  const dayStartMinutes = parseTime(dayStart)
  const midnightTs = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0)
  const dayStartTs = midnightTs + dayStartMinutes * 60_000
  return {
    dayStartTs,
    dayEndTs: midnightTs + MINUTES_PER_DAY * 60_000,
  }
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

function snapUpToStep(ts: number): number {
  const stepMs = STEP * 60_000
  return Math.ceil(ts / stepMs) * stepMs
}

function toRanges(blocks: Block[], exceptBlockId?: string): TimeRange[] {
  return blocks
    .filter((block) => block.id !== exceptBlockId)
    .map((block) => ({ start: parseIso(block.start), end: parseIso(block.end) }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start)
}

function findGapsAfter(
  ranges: TimeRange[],
  floorTs: number,
  dayStartTs: number,
  dayEndTs: number,
): Gap[] {
  const gaps: Gap[] = []
  let cursor = Math.max(floorTs, dayStartTs)

  for (const range of ranges) {
    if (range.end <= cursor) {
      continue
    }

    if (range.start > cursor) {
      const gapStart = cursor
      const gapEnd = Math.min(range.start, dayEndTs)
      if (gapEnd > gapStart) {
        gaps.push({
          start: gapStart,
          end: gapEnd,
          sizeMinutes: (gapEnd - gapStart) / 60_000,
        })
      }
    }

    cursor = Math.max(cursor, range.end)
    if (cursor >= dayEndTs) {
      return gaps
    }
  }

  if (cursor < dayEndTs) {
    gaps.push({
      start: cursor,
      end: dayEndTs,
      sizeMinutes: (dayEndTs - cursor) / 60_000,
    })
  }

  return gaps
}

function canRangeFit(ranges: TimeRange[], start: number, durationMinutes: number): boolean {
  const end = start + durationMinutes * 60_000
  for (const range of ranges) {
    if (range.end <= start) {
      continue
    }
    if (range.start >= end) {
      return true
    }
    return false
  }

  return true
}

function findFirstFreeSlot(ranges: TimeRange[], startAt: number, durationMinutes: number): number {
  let candidate = snapUpToStep(startAt)
  const durationMs = durationMinutes * 60_000

  for (const range of ranges) {
    if (range.end <= candidate) {
      continue
    }

    if (range.start >= candidate + durationMs) {
      return candidate
    }

    candidate = snapUpToStep(Math.max(candidate, range.end))
  }

  return candidate
}

function getDayBoundsForBlock(block: Block, dayStart: string): { dayStartTs: number; dayEndTs: number } {
  return toUtcDayBounds(block.start, dayStart)
}

function getOriginalGapSizeMinutes(
  blocks: Block[],
  targetBlock: Block,
  dayStartTs: number,
  dayEndTs: number,
): number {
  const ranges = toRanges(blocks, targetBlock.id)
  const start = parseIso(targetBlock.start)
  const end = parseIso(targetBlock.end)

  let left = dayStartTs
  let right = dayEndTs

  for (const range of ranges) {
    if (range.end <= start) {
      left = Math.max(left, range.end)
      continue
    }

    if (range.start >= end) {
      right = Math.min(right, range.start)
      break
    }
  }

  return Math.max(0, (right - left) / 60_000)
}

function placeAtEndOfDay(
  blocks: Block[],
  sourceBlock: Block,
  dayStart: string,
  makeupMinutes: number,
  exceptBlockId?: string,
): PlaceMakeupBlockResult {
  const { dayStartTs, dayEndTs } = getDayBoundsForBlock(sourceBlock, dayStart)
  const ranges = toRanges(blocks, exceptBlockId)
  const dayRanges = ranges.filter((range) => range.start < dayEndTs && range.end > dayStartTs)
  const lastEnd = dayRanges.reduce((max, range) => Math.max(max, range.end), dayStartTs)
  const startAt = snapUpToStep(lastEnd + END_OF_DAY_BUFFER_MIN * 60_000)
  const endAt = startAt + makeupMinutes * 60_000

  if (endAt <= dayEndTs) {
    return { start: toIso(startAt), end: toIso(endAt), placement: 'end_of_day' }
  }

  const nextDayStartTs = dayEndTs + parseTime(dayStart) * 60_000
  const nextStart = findFirstFreeSlot(ranges, nextDayStartTs, makeupMinutes)
  return {
    start: toIso(nextStart),
    end: toIso(nextStart + makeupMinutes * 60_000),
    placement: 'next_day',
  }
}

export function isPassingRating(rating: number): boolean {
  return rating >= PASS_RATING
}

export function getMakeupRawMinutes(rating: number, focusMinutes: number): number {
  if (isPassingRating(rating)) {
    return 0
  }

  const penalty = PENALTY_PCT[rating]
  if (penalty === undefined) {
    return 0
  }

  return focusMinutes * penalty
}

export function getMakeupMinutesForRating(rating: number, focusMinutes: number): number {
  return roundDuration(getMakeupRawMinutes(rating, focusMinutes))
}

export function getStackedMakeupMinutes(rawMakeupMinutes: number[]): number {
  const totalRaw = rawMakeupMinutes.reduce((total, minutes) => total + Math.max(0, minutes), 0)
  return roundDuration(totalRaw)
}

export function canFitMakeupInGap(makeupMinutes: number, gapMinutes: number): boolean {
  return makeupMinutes <= GAP_MAX_FRACTION * gapMinutes
}

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

export function getBlockEditPolicy(block: Block, now: Date, unlocked: boolean): EditableBlockPolicy {
  if (unlocked) {
    return {
      move: true,
      resizeStart: true,
      resizeEnd: true,
      delete: true,
      changeSubject: true,
      title: true,
    }
  }

  const nowTs = now.getTime()
  const startTs = parseIso(block.start)
  const endTs = parseIso(block.end)

  if (endTs <= nowTs) {
    return {
      move: false,
      resizeStart: false,
      resizeEnd: false,
      delete: false,
      changeSubject: false,
      title: false,
    }
  }

  if (startTs < nowTs && endTs > nowTs) {
    return {
      move: false,
      resizeStart: false,
      resizeEnd: true,
      delete: false,
      changeSubject: false,
      title: true,
    }
  }

  return {
    move: true,
    resizeStart: true,
    resizeEnd: true,
    delete: true,
    changeSubject: true,
    title: true,
  }
}

export function canSetBlockEnd(block: Block, nextEndIso: string, now: Date, unlocked: boolean): boolean {
  const policy = getBlockEditPolicy(block, now, unlocked)
  if (!policy.resizeEnd) {
    return false
  }

  return parseIso(nextEndIso) > now.getTime()
}

export function isEditable(time: string, now: Date, unlocked: boolean): boolean {
  if (unlocked) {
    return true
  }

  return new Date(time).getTime() >= now.getTime()
}

export function placeMakeupBlock({
  blocks,
  sourceBlock,
  now,
  dayStart,
  makeupMinutes,
  existingMakeupBlock,
}: PlaceMakeupBlockInput): PlaceMakeupBlockResult {
  if (makeupMinutes <= 0) {
    const fallbackStart = snapUpToStep(Math.max(parseIso(sourceBlock.end), now.getTime()))
    return {
      start: toIso(fallbackStart),
      end: toIso(fallbackStart),
      placement: 'gap',
    }
  }

  if (existingMakeupBlock) {
    const dayBounds = getDayBoundsForBlock(existingMakeupBlock, dayStart)
    const originalGapSizeMinutes = getOriginalGapSizeMinutes(
      blocks,
      existingMakeupBlock,
      dayBounds.dayStartTs,
      dayBounds.dayEndTs,
    )
    if (!canFitMakeupInGap(makeupMinutes, originalGapSizeMinutes)) {
      return placeAtEndOfDay(blocks, sourceBlock, dayStart, makeupMinutes, existingMakeupBlock.id)
    }
  }

  const { dayStartTs, dayEndTs } = getDayBoundsForBlock(sourceBlock, dayStart)
  const afterSourceAndNow = Math.max(parseIso(sourceBlock.end), now.getTime())
  const ranges = toRanges(blocks, existingMakeupBlock?.id)
  const gaps = findGapsAfter(ranges, afterSourceAndNow, dayStartTs, dayEndTs)

  for (const gap of gaps) {
    if (!canFitMakeupInGap(makeupMinutes, gap.sizeMinutes)) {
      continue
    }

    const gapStart = snapUpToStep(gap.start)
    const end = gapStart + makeupMinutes * 60_000
    if (end > gap.end) {
      continue
    }
    if (!canRangeFit(ranges, gapStart, makeupMinutes)) {
      continue
    }

    return {
      start: toIso(gapStart),
      end: toIso(end),
      placement: 'gap',
    }
  }

  return placeAtEndOfDay(blocks, sourceBlock, dayStart, makeupMinutes, existingMakeupBlock?.id)
}

export function isMidnightRollover(endIso: string, referenceIso: string): boolean {
  const end = parseIso(endIso)
  const ref = parseIso(referenceIso)
  if (!Number.isFinite(end) || !Number.isFinite(ref)) {
    return false
  }

  const boundary = toUtcDayBounds(referenceIso, DAY_END).dayStartTs
  return end > boundary
}
