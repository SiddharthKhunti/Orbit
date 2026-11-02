import { useMemo, useState } from 'react'

import {
  archiveSubject,
  createSubject,
  getActiveSubjects,
  getArchivedSubjects,
  getNextSubjectColor,
  isSubjectNameAvailable,
  normalizeSubjectName,
  recolorSubject,
  renameSubject,
} from '../logic/subjects'
import { useAppStore } from '../store'

function HomeTab() {
  const subjects = useAppStore((state) => state.data.subjects)
  const updateData = useAppStore((state) => state.updateData)

  const activeSubjects = useMemo(() => getActiveSubjects(subjects), [subjects])
  const archivedSubjects = useMemo(() => getArchivedSubjects(subjects), [subjects])
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(getNextSubjectColor(subjects))
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState('')

  const updateNameDraft = (subjectId: string, nextName: string) => {
    setNameDrafts((current) => ({
      ...current,
      [subjectId]: nextName,
    }))
  }

  const getNameDraft = (subjectId: string, fallbackName: string): string => {
    return nameDrafts[subjectId] ?? fallbackName
  }

  const handleAddSubject = () => {
    const normalizedName = normalizeSubjectName(newSubjectName)
    if (!normalizedName) {
      setErrorMessage('Subject name is required.')
      return
    }

    if (!isSubjectNameAvailable(subjects, normalizedName)) {
      setErrorMessage('Choose a unique subject name.')
      return
    }

    const createdSubject = createSubject(subjects, normalizedName, newSubjectColor)

    updateData((current) => ({
      ...current,
      subjects: [...current.subjects, createdSubject],
    }))
    setErrorMessage('')
    setNewSubjectName('')
    setNewSubjectColor(getNextSubjectColor([...subjects, createdSubject]))
    setNameDrafts((current) => ({
      ...current,
      [createdSubject.id]: createdSubject.name,
    }))
  }

  const handleRenameSubject = (subjectId: string, fallbackName: string) => {
    const draftName = getNameDraft(subjectId, fallbackName)
    const normalizedName = normalizeSubjectName(draftName)

    if (!normalizedName) {
      setErrorMessage('Subject name is required.')
      setNameDrafts((current) => ({
        ...current,
        [subjectId]: fallbackName,
      }))
      return
    }

    if (!isSubjectNameAvailable(subjects, normalizedName, subjectId)) {
      setErrorMessage('Choose a unique subject name.')
      return
    }

    updateData((current) => ({
      ...current,
      subjects: renameSubject(current.subjects, subjectId, normalizedName),
    }))
    setErrorMessage('')
    setNameDrafts((current) => ({
      ...current,
      [subjectId]: normalizedName,
    }))
  }

  const handleRecolorSubject = (subjectId: string, color: string) => {
    updateData((current) => ({
      ...current,
      subjects: recolorSubject(current.subjects, subjectId, color),
    }))
  }

  const handleArchiveSubject = (subjectId: string) => {
    const nextSubjects = archiveSubject(subjects, subjectId)
    if (nextSubjects === subjects) {
      setErrorMessage('Keep at least one active subject so new blocks can be created.')
      return
    }

    updateData((current) => ({
      ...current,
      subjects: archiveSubject(current.subjects, subjectId),
    }))
    setErrorMessage('')
  }

  return (
    <section className="orbit-card rounded-[28px] border p-6">
      <p className="orbit-muted max-w-2xl text-base">
        Review your subjects, study rhythm, and daily momentum from one focused place.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="orbit-card rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Subject Manager</h3>
            <span className="orbit-muted text-xs uppercase tracking-[0.14em]">{activeSubjects.length} active</span>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em]">
              Subject
              <input
                value={newSubjectName}
                onChange={(event) => setNewSubjectName(event.target.value)}
                placeholder="Add subject"
                className="rounded-xl border px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em]">
              Color
              <input
                type="color"
                value={newSubjectColor}
                onChange={(event) => setNewSubjectColor(event.target.value)}
                className="h-10 w-14 cursor-pointer rounded-xl border p-1"
              />
            </label>
            <button
              type="button"
              onClick={handleAddSubject}
              className="orbit-action-button rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              Add
            </button>
          </div>

          {errorMessage ? <p className="mt-3 text-sm text-rose-500">{errorMessage}</p> : null}

          <div className="mt-4 space-y-2">
            {activeSubjects.map((subject) => (
              <div key={subject.id} className="orbit-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
                <input
                  value={getNameDraft(subject.id, subject.name)}
                  onChange={(event) => updateNameDraft(subject.id, event.target.value)}
                  className="min-w-[10rem] flex-1 rounded-lg border px-2.5 py-2 text-sm"
                />
                <input
                  type="color"
                  value={subject.color}
                  onChange={(event) => handleRecolorSubject(subject.id, event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border p-1"
                />
                <button
                  type="button"
                  onClick={() => handleRenameSubject(subject.id, subject.name)}
                  className="rounded-lg border px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => handleArchiveSubject(subject.id)}
                  className="rounded-lg border px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                >
                  Archive
                </button>
              </div>
            ))}
          </div>

          {archivedSubjects.length > 0 ? (
            <div className="mt-5">
              <p className="orbit-muted text-xs font-semibold uppercase tracking-[0.14em]">Archived subjects</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {archivedSubjects.map((subject) => (
                  <span
                    key={subject.id}
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                    {subject.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="orbit-card rounded-2xl border p-4">
          <h3 className="text-base font-semibold">Legend</h3>
          <div className="mt-3 space-y-2">
            {activeSubjects.map((subject) => (
              <div key={subject.id} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                <span>{subject.name}</span>
              </div>
            ))}
            {activeSubjects.length === 0 ? (
              <p className="orbit-muted text-sm">Add a subject to schedule new study blocks.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="orbit-card rounded-2xl border p-4">
            <div className="orbit-action-button mb-3 h-2.5 w-16 rounded-full opacity-90" />
            <div className="h-4 w-3/4 rounded-full bg-[color:var(--color-bg-hover)]" />
            <div className="mt-3 h-4 w-1/2 rounded-full bg-[color:var(--color-bg-pressed)]" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default HomeTab
