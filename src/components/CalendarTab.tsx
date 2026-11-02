import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DateSelectArg, EventDropArg, EventInput } from '@fullcalendar/core'

import { useMemo } from 'react'

import {
  createPlannedBlock,
  getDefaultSubject,
  hasMinimumBlockDuration,
  isTimeGridView,
  updateBlockTime,
} from '../logic/calendarBlocks'
import { STEP } from '../logic/config'
import { useAppStore } from '../store'

function CalendarTab() {
  const subjects = useAppStore((state) => state.data.subjects)
  const blocks = useAppStore((state) => state.data.blocks)
  const updateData = useAppStore((state) => state.updateData)

  const defaultSubject = useMemo(() => getDefaultSubject(subjects), [subjects])

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
          classNames: ['orbit-calendar-event'],
        }
      }),
    [blocks, subjectColorById],
  )

  const handleSelect = (selection: DateSelectArg) => {
    if (!defaultSubject || !isTimeGridView(selection.view.type)) {
      selection.view.calendar.unselect()
      return
    }

    if (!hasMinimumBlockDuration(selection.start, selection.end)) {
      selection.view.calendar.unselect()
      return
    }

    const newBlock = createPlannedBlock({
      id: crypto.randomUUID(),
      subjectId: defaultSubject.id,
      title: `${defaultSubject.name} block`,
      start: selection.start,
      end: selection.end,
    })

    updateData((current) => ({
      ...current,
      blocks: [...current.blocks, newBlock],
    }))

    selection.view.calendar.unselect()
  }

  const updateBlockFromEvent = (eventId: string, start: Date | null, end: Date | null): boolean => {
    if (!start || !end || !hasMinimumBlockDuration(start, end)) {
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

  return (
    <section className="orbit-card orbit-calendar-shell rounded-[28px] border p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridDay,timeGridWeek,dayGridMonth',
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
        selectAllow={(selection) =>
          !selection.allDay && hasMinimumBlockDuration(selection.start, selection.end)
        }
        editable
        eventResizableFromStart
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        allDaySlot={false}
        slotDuration={`00:${String(STEP).padStart(2, '0')}:00`}
        snapDuration={`00:${String(STEP).padStart(2, '0')}:00`}
        dayMaxEvents
        height="auto"
        contentHeight="auto"
      />
    </section>
  )
}

export default CalendarTab
