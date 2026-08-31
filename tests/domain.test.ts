import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addYears, dateRange, localDate, parseLocalDate } from '../src/domain/dates'
import { expandEvent } from '../src/domain/recurrence'
import type { PlannerEvent } from '../src/domain/types'

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
