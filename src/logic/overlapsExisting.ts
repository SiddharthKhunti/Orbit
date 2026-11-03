import type { Block } from '../types'

type TimeRangeCandidate = Pick<Block, 'start' | 'end'>

function parseIso(value: string): number {
  return new Date(value).getTime()
}

export function overlapsExisting(candidate: TimeRangeCandidate, blocks: Block[], ignoreId?: string): boolean {
  const candidateStart = parseIso(candidate.start)
  const candidateEnd = parseIso(candidate.end)
  if (!Number.isFinite(candidateStart) || !Number.isFinite(candidateEnd) || candidateEnd <= candidateStart) {
    return false
  }

  return blocks
    .filter((block) => block.id !== ignoreId)
    .some((block) => {
      const blockStart = parseIso(block.start)
      const blockEnd = parseIso(block.end)
      if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd) || blockEnd <= blockStart) {
        return false
      }

      return candidateStart < blockEnd && blockStart < candidateEnd
    })
}
