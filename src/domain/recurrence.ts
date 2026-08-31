import { addDays, addMonths, addYears, daysBetween } from './dates'
import type { LocalDate, PlannerEvent } from './types'

const MAX_OCCURRENCES = 730

export function expandEvent(event: PlannerEvent, rangeStart: LocalDate, rangeEndExclusive: LocalDate): PlannerEvent[] {
  if (!event.recurrence) return event.endDateExclusive > rangeStart && event.startDate < rangeEndExclusive ? [event] : []
  const duration = daysBetween(event.startDate, event.endDateExclusive)
  const result: PlannerEvent[] = []
  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    const { interval, frequency } = event.recurrence
    const occurrenceStart = frequency === 'weekly'
      ? addDays(event.startDate, 7 * interval * index)
      : frequency === 'monthly'
        ? addMonths(event.startDate, interval * index)
        : addYears(event.startDate, interval * index)
    if (occurrenceStart >= rangeEndExclusive) break
    if (event.recurrence.until && occurrenceStart > event.recurrence.until) break
    const occurrenceEnd = addDays(occurrenceStart, duration)
    if (occurrenceEnd > rangeStart) {
      result.push({ ...event, id: `${event.id}::${occurrenceStart}`, startDate: occurrenceStart, endDateExclusive: occurrenceEnd })
    }
  }
  return result
}
