import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addYears, dateRange, localDate, parseLocalDate } from '../src/domain/dates'
import { expandEvent } from '../src/domain/recurrence'
import { activeMonthIndexes, isDateInScope } from '../src/domain/scope'
import { isEmbedPath } from '../src/embed'
import { deleteCalendar, isLocalTime, updateCalendarDetails, validateEventTiming, type PlannerEvent, type PlannerState } from '../src/domain/types'

const event: PlannerEvent = {
  id: 'event-1', calendarId: 'calendar-1', title: 'Review', description: '',
  startDate: '2028-02-29', endDateExclusive: '2028-03-02', allDay: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('local date arithmetic', () => {
  it('handles leap years and validates impossible dates', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28')
    expect(() => parseLocalDate('2027-02-29')).toThrow('Несуществующая')
  })

  it('clamps month changes and guards abusive ranges', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(dateRange('2026-01-01', '2026-01-04')).toHaveLength(3)
    expect(() => dateRange('2026-01-01', '2040-01-01')).toThrow('10 лет')
  })

  it('formats a local date without the runtime timezone', () => {
    expect(localDate(2026, 8, 3)).toBe('2026-08-03')
  })
})

describe('recurrence expansion', () => {
  it('preserves multi-day duration for weekly recurrence', () => {
    const occurrences = expandEvent({ ...event, recurrence: { frequency: 'weekly', interval: 1, until: '2028-03-31' } }, '2028-03-01', '2028-04-01')
    expect(occurrences.map(({ startDate, endDateExclusive }) => [startDate, endDateExclusive])).toEqual([
      ['2028-02-29', '2028-03-02'], ['2028-03-07', '2028-03-09'], ['2028-03-14', '2028-03-16'],
      ['2028-03-21', '2028-03-23'], ['2028-03-28', '2028-03-30'],
    ])
  })

  it('clamps a monthly recurrence on short months', () => {
    const occurrences = expandEvent({ ...event, startDate: '2026-01-31', endDateExclusive: '2026-02-01', recurrence: { frequency: 'monthly', interval: 1 } }, '2026-01-01', '2026-04-01')
    expect(occurrences.map(({ startDate }) => startDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
})

describe('optional event time', () => {
  it('keeps legacy all-day events valid and accepts a bounded local time slot', () => {
    expect(() => validateEventTiming(event)).not.toThrow()
    expect(isLocalTime('09:30')).toBe(true)
    expect(isLocalTime('24:00')).toBe(false)
    expect(() => validateEventTiming({ ...event, allDay: false, startTime: '09:30', endTime: '10:45' })).not.toThrow()
    expect(() => validateEventTiming({ ...event, allDay: false, endTime: '10:45' })).toThrow('начала')
    expect(() => validateEventTiming({ ...event, allDay: true, startTime: '09:30' })).toThrow('весь день')
    expect(() => validateEventTiming({ ...event, startDate: '2026-09-10', endDateExclusive: '2026-09-11', allDay: false, startTime: '10:45', endTime: '09:30' })).toThrow('позже')
  })
})

describe('planner period scope', () => {
  const today = '2026-09-01' as const

  it('keeps future dates and excludes every past date, including the previous day', () => {
    expect(activeMonthIndexes(2026, 'future', [], today)).toEqual([8, 9, 10, 11])
    expect(isDateInScope('2026-08-31', 2026, 'future', [], today)).toBe(false)
    expect(isDateInScope('2026-09-01', 2026, 'future', [], today)).toBe(true)
    expect(activeMonthIndexes(2025, 'future', [], today)).toEqual([])
    expect(activeMonthIndexes(2027, 'future', [], today)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('selects exact quarters and normalized custom months', () => {
    expect(activeMonthIndexes(2026, 'q2', [], today)).toEqual([3, 4, 5])
    expect(activeMonthIndexes(2026, 'custom', [10, 1, 10, 7], today)).toEqual([1, 7, 10])
    expect(isDateInScope('2026-08-12', 2026, 'custom', [1, 7, 10], today)).toBe(true)
    expect(isDateInScope('2026-09-12', 2026, 'custom', [1, 7, 10], today)).toBe(false)
  })
})

describe('calendar details', () => {
  it('renames and recolours a calendar without changing identity, visibility or event links', () => {
    const state: PlannerState = {
      schemaVersion: 1,
      calendars: [{ id: 'calendar-1', name: 'Личное', color: '#40e0d0', visible: false, createdAt: '2026-01-01T00:00:00.000Z' }],
      events: [event],
    }
    const updated = updateCalendarDetails(state, 'calendar-1', '  Работа  ', '#69a7ff')
    expect(updated.calendars).toEqual([{ id: 'calendar-1', name: 'Работа', color: '#69a7ff', visible: false, createdAt: '2026-01-01T00:00:00.000Z' }])
    expect(updated.events).toBe(state.events)
    expect(() => updateCalendarDetails(state, 'calendar-1', '   ', '#69a7ff')).toThrow('Введите название')
    expect(() => updateCalendarDetails(state, 'missing', 'Работа', '#69a7ff')).toThrow('не найден')
  })

  it('deletes a calendar and only its linked events, while preserving a usable last calendar', () => {
    const otherEvent = { ...event, id: 'event-2', calendarId: 'calendar-2' }
    const state: PlannerState = {
      schemaVersion: 1,
      calendars: [
        { id: 'calendar-1', name: 'Личное', color: '#40e0d0', visible: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'calendar-2', name: 'Работа', color: '#69a7ff', visible: true, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      events: [event, otherEvent],
    }
    const updated = deleteCalendar(state, 'calendar-1')
    expect(updated.calendars.map(({ id }) => id)).toEqual(['calendar-2'])
    expect(updated.events).toEqual([otherEvent])
    expect(() => deleteCalendar(updated, 'calendar-2')).toThrow('единственный')
    expect(() => deleteCalendar(state, 'missing')).toThrow('не найден')
  })
})

describe('embed route', () => {
  it('only strips standalone chrome on the dedicated embed path', () => {
    expect(isEmbedPath('/embed/')).toBe(true)
    expect(isEmbedPath('/embed')).toBe(true)
    expect(isEmbedPath('/')).toBe(false)
    expect(isEmbedPath('/calendar/embed/')).toBe(false)
  })
})
