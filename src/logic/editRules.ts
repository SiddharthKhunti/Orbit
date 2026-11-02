import type { Block } from '../types'

type EditableBlockAction = 'move' | 'resizeStart' | 'resizeEnd' | 'delete' | 'changeSubject' | 'title'
type EditableBlockPolicy = Record<EditableBlockAction, boolean>

function parseIso(value: string): number {
  return new Date(value).getTime()
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

  if (unlocked) {
    return true
  }

  return parseIso(nextEndIso) > now.getTime()
}

export function isEditable(time: string, now: Date, unlocked: boolean): boolean {
  if (unlocked) {
    return true
  }

  return new Date(time).getTime() >= now.getTime()
}
