import { describe, expect, it } from 'vitest'

import type { Subject } from '../types'
import {
  archiveSubject,
  canArchiveSubject,
  createSubject,
  getActiveSubjects,
  getArchivedSubjects,
  getNextSubjectColor,
  isSubjectNameAvailable,
  normalizeSubjectName,
  recolorSubject,
  renameSubject,
} from './subjects'

const baseSubjects: Subject[] = [
  { id: 'math', name: 'Math', color: '#5b21b6', archived: false },
  { id: 'science', name: 'Science', color: '#1d4ed8', archived: false },
  { id: 'history', name: 'History', color: '#0369a1', archived: true },
]

describe('subjects logic', () => {
  it('normalizes names and checks availability case-insensitively', () => {
    expect(normalizeSubjectName('  Advanced   Math  ')).toBe('Advanced Math')
    expect(isSubjectNameAvailable(baseSubjects, 'science')).toBe(false)
    expect(isSubjectNameAvailable(baseSubjects, 'science', 'science')).toBe(true)
    expect(isSubjectNameAvailable(baseSubjects, '  ')).toBe(false)
  })

  it('returns active and archived groups', () => {
    expect(getActiveSubjects(baseSubjects).map((subject) => subject.id)).toEqual(['math', 'science'])
    expect(getArchivedSubjects(baseSubjects).map((subject) => subject.id)).toEqual(['history'])
  })

  it('picks an unused default color first, then cycles through the palette', () => {
    expect(getNextSubjectColor(baseSubjects, ['#5b21b6', '#1d4ed8', '#be123c'])).toBe('#be123c')
    expect(
      getNextSubjectColor(
        [
          { id: 'a', name: 'A', color: '#5b21b6', archived: false },
          { id: 'b', name: 'B', color: '#1d4ed8', archived: false },
          { id: 'c', name: 'C', color: '#be123c', archived: false },
        ],
        ['#5b21b6', '#1d4ed8', '#be123c'],
      ),
    ).toBe('#5b21b6')
  })

  it('creates subjects with stable unique ids', () => {
    const first = createSubject(baseSubjects, 'Math', '#be123c')
    const second = createSubject([...baseSubjects, first], 'Math', '#c2410c')

    expect(first.id).toBe('math-2')
    expect(second.id).toBe('math-3')
    expect(first.archived).toBe(false)
  })

  it('renames and recolors by id', () => {
    const renamed = renameSubject(baseSubjects, 'science', '  Natural Science  ')
    const recolored = recolorSubject(renamed, 'science', '#c2410c')

    expect(recolored.find((subject) => subject.id === 'science')?.name).toBe('Natural Science')
    expect(recolored.find((subject) => subject.id === 'science')?.color).toBe('#c2410c')
  })

  it('only archives when at least one active subject remains', () => {
    expect(canArchiveSubject(baseSubjects, 'math')).toBe(true)
    expect(archiveSubject(baseSubjects, 'math').find((subject) => subject.id === 'math')?.archived).toBe(true)
    expect(
      canArchiveSubject(
        [
          { id: 'only', name: 'Only', color: '#5b21b6', archived: false },
          { id: 'old', name: 'Old', color: '#1d4ed8', archived: true },
        ],
        'only',
      ),
    ).toBe(false)
  })
})
