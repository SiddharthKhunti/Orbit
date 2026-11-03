import type { Block } from '../types'
import { DAY_END, END_OF_DAY_BUFFER_MIN, GAP_MAX_FRACTION, PASS_RATING, PENALTY_PCT, STEP } from './config'
import { overlapsExisting } from './overlapsExisting'
import { roundDuration } from './roundDuration'

const MINUTES_PER_DAY = 24 * 60

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

type UpsertMakeupBlockInput = {
  blocks: Block[]
  sourceBlock: Block
  rating: number
  focusMinutes: number
  now: Date
  dayStart: string
  sessionId: string
  existingStackedRawMinutes?: number[]
  createId?: () => string
}

type UpsertMakeupBlockResult =
  | { action: 'none'; rawMinutes: number; makeupMinutes: 0; block: null }
  | { action: 'created' | 'stacked'; rawMinutes: number; makeupMinutes: number; block: Block }

function parseIso(value: string): number {
  return new Date(value).getTime()
}

function toIso(ts: number): string {
  return new Date(ts).toISOString()
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

function findGapsAfter(ranges: TimeRange[], floorTs: number, dayStartTs: number, dayEndTs: number): Gap[] {
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
  const startAt = findFirstFreeSlot(ranges, snapUpToStep(lastEnd + END_OF_DAY_BUFFER_MIN * 60_000), makeupMinutes)
  const endAt = startAt + makeupMinutes * 60_000

  if (
    endAt <= dayEndTs &&
    !overlapsExisting(
      {
        start: toIso(startAt),
        end: toIso(endAt),
      },
      blocks,
      exceptBlockId,
    )
  ) {
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

function isInStudyDay(iso: string, sourceIso: string, dayStart: string): boolean {
  const sourceBounds = toUtcDayBounds(sourceIso, dayStart)
  const ts = parseIso(iso)
  return ts >= sourceBounds.dayStartTs && ts < sourceBounds.dayEndTs
}

function getMakeupDurationMinutes(block: Block): number {
  const start = parseIso(block.start)
  const end = parseIso(block.end)
  return Math.max(0, (end - start) / 60_000)
}

function findStackableMakeupBlock(blocks: Block[], sourceBlock: Block, dayStart: string): Block | undefined {
  return blocks
    .filter((block) => block.kind === 'makeup')
    .filter((block) => block.subjectId === sourceBlock.subjectId)
    .filter((block) => block.title === sourceBlock.title)
    .filter((block) => isInStudyDay(block.start, sourceBlock.start, dayStart))
    .sort((a, b) => parseIso(a.start) - parseIso(b.start))[0]
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
    if (
      overlapsExisting(
        {
          start: toIso(gapStart),
          end: toIso(end),
        },
        blocks,
        existingMakeupBlock?.id,
      )
    ) {
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

export function upsertMakeupBlockForSession({
  blocks,
  sourceBlock,
  rating,
  focusMinutes,
  now,
  dayStart,
  sessionId,
  existingStackedRawMinutes,
  createId,
}: UpsertMakeupBlockInput): UpsertMakeupBlockResult {
  const rawMinutes = getMakeupRawMinutes(rating, focusMinutes)
  if (rawMinutes <= 0) {
    return {
      action: 'none',
      rawMinutes,
      makeupMinutes: 0,
      block: null,
    }
  }

  const existing = findStackableMakeupBlock(blocks, sourceBlock, dayStart)
  const seedRaw = existingStackedRawMinutes ?? (existing ? [getMakeupDurationMinutes(existing)] : [])
  const makeupMinutes = getStackedMakeupMinutes([...seedRaw, rawMinutes])
  const placement = placeMakeupBlock({
    blocks,
    sourceBlock,
    now,
    dayStart,
    makeupMinutes,
    existingMakeupBlock: existing,
  })

  if (existing) {
    const ids = new Set(existing.makeupSourceSessionIds ?? [])
    ids.add(sessionId)
    return {
      action: 'stacked',
      rawMinutes,
      makeupMinutes,
      block: {
        ...existing,
        start: placement.start,
        end: placement.end,
        makeupSourceSessionIds: [...ids],
      },
    }
  }

  return {
    action: 'created',
    rawMinutes,
    makeupMinutes,
    block: {
      id: createId?.() ?? `makeup-${sessionId}`,
      subjectId: sourceBlock.subjectId,
      title: sourceBlock.title,
      start: placement.start,
      end: placement.end,
      kind: 'makeup',
      makeupSourceSessionIds: [sessionId],
    },
  }
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
