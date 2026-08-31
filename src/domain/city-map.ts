import { getCity, type PlannerCity } from '../data/cities'
import { localDate } from './dates'
import { expandEvent } from './recurrence'
import type { PlannerEvent, PlannerState } from './types'

export interface CityEventGroup {
  city: PlannerCity
  occurrences: PlannerEvent[]
}

export function cityEventGroups(state: PlannerState, year: number): CityEventGroup[] {
  const visibleCalendars = new Set(state.calendars.filter(({ visible }) => visible).map(({ id }) => id))
  const rangeStart = localDate(year, 1, 1)
  const rangeEnd = localDate(year + 1, 1, 1)
  const groups = new Map<string, PlannerEvent[]>()

  for (const event of state.events) {
    if (!event.cityId || !visibleCalendars.has(event.calendarId)) continue
    const city = getCity(event.cityId)
    if (!city) continue
    const occurrences = expandEvent(event, rangeStart, rangeEnd)
    if (!occurrences.length) continue
    groups.set(city.id, [...(groups.get(city.id) ?? []), ...occurrences])
  }

  return [...groups.entries()]
    .map(([cityId, occurrences]) => ({
      city: getCity(cityId)!,
      occurrences: occurrences.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'ru')),
    }))
    .sort((a, b) => a.occurrences[0].startDate.localeCompare(b.occurrences[0].startDate) || a.city.name.localeCompare(b.city.name, 'ru'))
}
