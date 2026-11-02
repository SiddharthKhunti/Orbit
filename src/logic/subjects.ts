import { DEFAULT_SUBJECT_COLORS } from './config'
import type { Subject } from '../types'

function toSubjectId(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const collapsed = normalized.replace(/^-+|-+$/g, '')
  return collapsed || 'subject'
}

export function normalizeSubjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function isSubjectNameAvailable(subjects: Subject[], name: string, excludingId?: string): boolean {
  const target = normalizeSubjectName(name).toLowerCase()
  if (!target) {
    return false
  }

  return !subjects.some((subject) => {
    if (excludingId && subject.id === excludingId) {
      return false
    }

    return subject.name.toLowerCase() === target
  })
}

export function getActiveSubjects(subjects: Subject[]): Subject[] {
  return subjects.filter((subject) => !subject.archived)
}

export function getArchivedSubjects(subjects: Subject[]): Subject[] {
  return subjects.filter((subject) => subject.archived)
}

export function getNextSubjectColor(
  subjects: Subject[],
  palette: string[] = DEFAULT_SUBJECT_COLORS,
): string {
  if (palette.length === 0) {
    return '#5b21b6'
  }

  const activeColorSet = new Set(getActiveSubjects(subjects).map((subject) => subject.color.toLowerCase()))
  const firstUnusedColor = palette.find((color) => !activeColorSet.has(color.toLowerCase()))
  if (firstUnusedColor) {
    return firstUnusedColor
  }

  return palette[getActiveSubjects(subjects).length % palette.length]
}

export function createSubject(subjects: Subject[], name: string, color: string): Subject {
  const baseId = toSubjectId(name)
  const existingIds = new Set(subjects.map((subject) => subject.id))
  let id = baseId
  let suffix = 2

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return {
    id,
    name: normalizeSubjectName(name),
    color,
    archived: false,
  }
}

export function renameSubject(subjects: Subject[], subjectId: string, nextName: string): Subject[] {
  const normalizedName = normalizeSubjectName(nextName)
  if (!normalizedName) {
    return subjects
  }

  return subjects.map((subject) =>
    subject.id === subjectId
      ? {
          ...subject,
          name: normalizedName,
        }
      : subject,
  )
}

export function recolorSubject(subjects: Subject[], subjectId: string, color: string): Subject[] {
  return subjects.map((subject) =>
    subject.id === subjectId
      ? {
          ...subject,
          color,
        }
      : subject,
  )
}

export function canArchiveSubject(subjects: Subject[], subjectId: string): boolean {
  const subject = subjects.find((item) => item.id === subjectId)
  if (!subject || subject.archived) {
    return false
  }

  return getActiveSubjects(subjects).length > 1
}

export function archiveSubject(subjects: Subject[], subjectId: string): Subject[] {
  if (!canArchiveSubject(subjects, subjectId)) {
    return subjects
  }

  return subjects.map((subject) =>
    subject.id === subjectId
      ? {
          ...subject,
          archived: true,
        }
      : subject,
  )
}
