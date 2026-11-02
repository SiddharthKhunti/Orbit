import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, EventDropArg, EventInput } from '@fullcalendar/core'

import { useMemo, useState } from 'react'

import {
  createPlannedBlock,
  getDefaultSubject,
  hasMinimumBlockDuration,
  isTimeGridView,
  updateBlockTime,
} from '../logic/calendarBlocks'
import { STEP } from '../logic/config'
import { canSetBlockEnd, getBlockEditPolicy, isEditable } from '../logic/editRules'
import { useAppStore } from '../store'
import type { Block } from '../types'

type BlockPopoverState = {
  blockId: string
  x: number
  y: number
}

function toTimestamp(value: string): number {
  return new Date(value).getTime()
}

function CalendarTab() {
  const subjects = useAppStore((state) => state.data.subjects)
  const blocks = useAppStore((state) => state.data.blocks)
  const updateData = useAppStore((state) => state.updateData)
  const [unlocked, setUnlocked] = useState(false)
  const [blockPopover, setBlockPopover] = useState<BlockPopoverState | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftSubjectId, setDraftSubjectId] = useState('')

  const defaultSubject = useMemo(() => getDefaultSubject(subjects), [subjects])
  const blockById = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks])
  const activePopoverBlock = useMemo(
    () => (blockPopover ? blockById.get(blockPopover.blockId) ?? null : null),
    [blockById, blockPopover],
  )
  const activePopoverPolicy = useMemo(
    () => (activePopoverBlock ? getBlockEditPolicy(activePopoverBlock, new Date(), unlocked) : null),
    [activePopoverBlock, unlocked],
  )

  const popoverSubjects = useMemo(() => {
    if (!activePopoverBlock) {
      return subjects.filter((subject) => !subject.archived)
    }

    return subjects.filter((subject) => !subject.archived || subject.id === activePopoverBlock.subjectId)
  }, [activePopoverBlock, subjects])

  const subjectColorById = useMemo(
    () =>
      new Map(
        subjects.map((subject) => [
          subject.id,
          { name: subject.name, color: subject.color },
        ]),
      ),
    [subjects],
  )

  const events = useMemo<EventInput[]>(
    () =>
      blocks.map((block) => {
        const subject = subjectColorById.get(block.subjectId)
        const blockColor = subject?.color ?? 'var(--color-accent)'

        return {
          id: block.id,
          title: block.title,
          start: block.start,
          end: block.end,
          backgroundColor: blockColor,
          borderColor: blockColor,
          extendedProps: {
            manual: block.manual ?? false,
          },
          classNames: ['orbit-calendar-event'],
        }
      }),
    [blocks, subjectColorById],
  )

  const canApplyBlockTimeChange = (block: Block, nextStart: Date, nextEnd: Date): boolean => {
    if (!hasMinimumBlockDuration(nextStart, nextEnd)) {
      return false
    }

    const now = new Date()
    const policy = getBlockEditPolicy(block, now, unlocked)
    const currentStartTs = toTimestamp(block.start)
    const currentEndTs = toTimestamp(block.end)
    const nextStartTs = nextStart.getTime()
    const nextEndTs = nextEnd.getTime()
    const startChanged = nextStartTs !== currentStartTs
    const endChanged = nextEndTs !== currentEndTs

    if (startChanged && endChanged && !policy.move) {
      return false
    }

    if (startChanged && !endChanged && !policy.resizeStart) {
      return false
    }

    if (!startChanged && endChanged && !policy.resizeEnd) {
      return false
    }

    if (startChanged && !isEditable(nextStart.toISOString(), now, unlocked)) {
      return false
    }

    if (endChanged && !canSetBlockEnd(block, nextEnd.toISOString(), now, unlocked)) {
      return false
    }

    return true
  }

  const closePopover = () => {
    setBlockPopover(null)
    setDraftTitle('')
    setDraftSubjectId('')
  }

  const handleSelect = (selection: DateSelectArg) => {
    if (!defaultSubject || !isTimeGridView(selection.view.type)) {
      selection.view.calendar.unselect()
      return
    }

    if (
      !hasMinimumBlockDuration(selection.start, selection.end) ||
      !isEditable(selection.start.toISOString(), new Date(), unlocked) ||
      !isEditable(selection.end.toISOString(), new Date(), unlocked)
    ) {
      selection.view.calendar.unselect()
      return
    }

    const newBlock = createPlannedBlock({
      id: crypto.randomUUID(),
      subjectId: defaultSubject.id,
      title: `${defaultSubject.name} block`,
      start: selection.start,
      end: selection.end,
      manual: unlocked,
    })

    updateData((current) => ({
      ...current,
      blocks: [...current.blocks, newBlock],
    }))

    selection.view.calendar.unselect()
  }

  const updateBlockFromEvent = (eventId: string, start: Date | null, end: Date | null): boolean => {
    if (!start || !end) {
      return false
    }

    const block = blockById.get(eventId)
    if (!block || !canApplyBlockTimeChange(block, start, end)) {
      return false
    }

    updateData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === eventId ? updateBlockTime(block, start, end) : block)),
    }))

    return true
  }

  const handleEventDrop = (change: EventDropArg) => {
    if (!isTimeGridView(change.view.type)) {
      change.revert()
      return
    }

    if (!updateBlockFromEvent(change.event.id, change.event.start, change.event.end)) {
      change.revert()
    }
  }

  const handleEventResize = (change: EventResizeDoneArg) => {
    if (!isTimeGridView(change.view.type)) {
      change.revert()
      return
    }

    if (!updateBlockFromEvent(change.event.id, change.event.start, change.event.end)) {
      change.revert()
    }
  }

  const handleToggleUnlock = () => {
    if (!unlocked) {
      const confirmed = window.confirm(
        'Unlock past edits and manual logging? Items created while unlocked will be marked as manual.',
      )
      if (!confirmed) {
        return
      }
    }

    setUnlocked((current) => !current)
  }

  const handleSavePopover = () => {
    if (!activePopoverBlock || !activePopoverPolicy) {
      closePopover()
      return
    }

    updateData((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== activePopoverBlock.id) {
          return block
        }

        return {
          ...block,
          title: activePopoverPolicy.title ? draftTitle.trim() || block.title : block.title,
          subjectId: activePopoverPolicy.changeSubject ? draftSubjectId : block.subjectId,
        }
      }),
    }))
    closePopover()
  }

  const handleDeleteBlock = () => {
    if (!activePopoverBlock || !activePopoverPolicy?.delete) {
      return
    }

    updateData((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== activePopoverBlock.id),
    }))
    closePopover()
  }

  return (
    <section className="orbit-card orbit-calendar-shell rounded-[28px] border p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        customButtons={{
          unlockToggle: {
            text: unlocked ? 'Unlocked' : 'Locked',
            click: handleToggleUnlock,
          },
        }}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'unlockToggle timeGridDay,timeGridWeek,dayGridMonth',
        }}
        views={{
          timeGridDay: { buttonText: 'Day' },
          timeGridWeek: { buttonText: 'Week' },
          dayGridMonth: { buttonText: 'Month' },
        }}
        events={events}
        selectable
        selectMirror
        select={handleSelect}
        selectAllow={(selection) => {
          const now = new Date()
          return (
            !selection.allDay &&
            hasMinimumBlockDuration(selection.start, selection.end) &&
            isEditable(selection.start.toISOString(), now, unlocked) &&
            isEditable(selection.end.toISOString(), now, unlocked)
          )
        }}
        editable
        eventAllow={(dropInfo, draggedEvent) => {
          if (!draggedEvent) {
            return false
          }

          const block = blockById.get(draggedEvent.id)
          if (!block || !dropInfo.end) {
            return false
          }

          return canApplyBlockTimeChange(block, dropInfo.start, dropInfo.end)
        }}
        eventClick={(clickInfo) => {
          const block = blockById.get(clickInfo.event.id)
          if (!block) {
            return
          }

          setDraftTitle(block.title)
          setDraftSubjectId(block.subjectId)
          setBlockPopover({
            blockId: block.id,
            x: clickInfo.jsEvent.clientX,
            y: clickInfo.jsEvent.clientY,
          })
        }}
        eventResizableFromStart
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventContent={(content) => (
          <div className="orbit-calendar-event-content">
            <span>{content.event.title}</span>
            {content.event.extendedProps.manual ? (
              <span className="orbit-calendar-manual-badge">manual</span>
            ) : null}
          </div>
        )}
        allDaySlot={false}
        slotDuration={`00:${String(STEP).padStart(2, '0')}:00`}
        snapDuration={`00:${String(STEP).padStart(2, '0')}:00`}
        dayMaxEvents
        height="auto"
        contentHeight="auto"
      />
      {blockPopover && activePopoverBlock && activePopoverPolicy ? (
        <>
          <button
            type="button"
            aria-label="Close block editor"
            onClick={closePopover}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            className="orbit-card fixed z-50 w-72 rounded-2xl border p-4 shadow-xl"
            style={{ top: Math.min(blockPopover.y + 10, window.innerHeight - 220), left: Math.min(blockPopover.x + 10, window.innerWidth - 300) }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Edit Block</p>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em]">Title</label>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              disabled={!activePopoverPolicy.title}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em]">Subject</label>
            <select
              value={draftSubjectId}
              onChange={(event) => setDraftSubjectId(event.target.value)}
              disabled={!activePopoverPolicy.changeSubject}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            >
              {popoverSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDeleteBlock}
                disabled={!activePopoverPolicy.delete}
                className="rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closePopover}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePopover}
                  className="orbit-action-button rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default CalendarTab
