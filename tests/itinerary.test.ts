import { describe, expect, it } from 'vitest'
import { deriveItinerary } from '../src/domain/itinerary'
import type { PlannerEvent, PlannerState } from '../src/domain/types'

const calendars: PlannerState['calendars'] = [
  { id: 'visible', name: 'Видимый', color: '#40e0d0', visible: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'hidden', name: 'Скрытый', color: '#69a7ff', visible: false, createdAt: '2026-01-01T00:00:00.000Z' },
]

function planned(id: string, cityId: string, startDate: PlannerEvent['startDate'], options: Partial<PlannerEvent> = {}): PlannerEvent {
  return {
    id,
    cityId,
    calendarId: 'visible',
    title: id,
    description: '',
    startDate,
    endDateExclusive: `${startDate.slice(0, 8)}${String(Number(startDate.slice(8)) + 1).padStart(2, '0')}` as PlannerEvent['endDateExclusive'],
    allDay: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...options,
  }
}

function state(events: PlannerEvent[]): PlannerState {
  return { schemaVersion: 1, calendars, events }
}

describe('chronological travel itinerary', () => {
  it('is deterministic for shuffled input and sorts by date, optional time, then stable id', () => {
    const events = [
      planned('z-late', 'paris', '2026-03-02', { allDay: false, startTime: '18:00' }),
      planned('b-morning', 'moscow', '2026-03-02', { allDay: false, startTime: '09:00' }),
      planned('a-morning', 'kazan', '2026-03-02', { allDay: false, startTime: '09:00' }),
      planned('all-day', 'ivanovo', '2026-03-02'),
    ]
    const ordered = deriveItinerary(state(events), 2026, 'world')
    const shuffled = deriveItinerary(state([events[1], events[3], events[0], events[2]]), 2026, 'world')

    expect(ordered.stops.map((stop) => stop.occurrences[0].id)).toEqual(['all-day', 'a-morning', 'b-morning', 'z-late'])
    expect(shuffled).toEqual(ordered)
  })

  it('excludes hidden calendars, unknown cities and occurrences outside the requested year', () => {
    const trip = deriveItinerary(state([
      planned('shown', 'moscow', '2026-05-01'),
      planned('hidden', 'paris', '2026-05-02', { calendarId: 'hidden' }),
      planned('unknown', 'not-in-catalogue', '2026-05-03'),
      planned('next-year', 'berlin', '2027-05-04'),
    ]), 2026, 'world')

    expect(trip.stops.map(({ city }) => city.id)).toEqual(['moscow'])
    expect(trip.summary.occurrenceCount).toBe(1)
  })

  it('collapses only consecutive repeat cities, retains their occurrences, and creates no fake same-city leg', () => {
    const trip = deriveItinerary(state([
      planned('moscow-1', 'moscow', '2026-06-01'),
      planned('moscow-2', 'moscow', '2026-06-02'),
      planned('paris', 'paris', '2026-06-03'),
      planned('moscow-return', 'moscow', '2026-06-04'),
    ]), 2026, 'world')

    expect(trip.stops.map(({ city }) => city.id)).toEqual(['moscow', 'paris', 'moscow'])
    expect(trip.stops[0].occurrences.map(({ id }) => id)).toEqual(['moscow-1', 'moscow-2'])
    expect(trip.legs.map(({ number, from, to }) => [number, from.city.id, to.city.id])).toEqual([
      [1, 'moscow', 'paris'],
      [2, 'paris', 'moscow'],
    ])
  })

  it('expands recurring city events inside the year before ordering the route', () => {
    const trip = deriveItinerary(state([
      planned('monthly', 'kazan', '2026-01-15', { recurrence: { frequency: 'monthly', interval: 1, until: '2026-03-15' } }),
      planned('between', 'moscow', '2026-02-01'),
    ]), 2026, 'world')

    expect(trip.stops.map(({ city }) => city.id)).toEqual(['kazan', 'moscow', 'kazan'])
    expect(trip.stops.at(-1)?.occurrences.map(({ startDate }) => startDate)).toEqual(['2026-02-15', '2026-03-15'])
  })

  it('builds world and Russia summaries without leaking non-Russian cities', () => {
    const travel = state([
      planned('moscow', 'moscow', '2026-07-01'),
      planned('paris', 'paris', '2026-07-02'),
      planned('ivanovo', 'ivanovo', '2026-07-03'),
      planned('moscow-again', 'moscow', '2026-07-04'),
    ])
    const world = deriveItinerary(travel, 2026, 'world')
    const russia = deriveItinerary(travel, 2026, 'russia')

    expect(world.summary).toMatchObject({ level: 'world', occurrenceCount: 4, stopCount: 4, legCount: 3, visitedCityCount: 3, visitedCountryCount: 2 })
    expect(world.summary.visitedCountries).toEqual(['Россия', 'Франция'])
    expect(russia.stops.map(({ city }) => city.id)).toEqual(['moscow', 'ivanovo', 'moscow'])
    expect(russia.stops.every(({ city }) => city.country === 'Россия')).toBe(true)
    expect(russia.summary).toMatchObject({ level: 'russia', occurrenceCount: 3, stopCount: 3, legCount: 2, visitedCityCount: 2, visitedCountryCount: 1 })
    expect(russia.summary.visitedCountries).toEqual(['Россия'])
  })

  it('returns an empty, fully counted itinerary when no visible travel exists', () => {
    expect(deriveItinerary(state([]), 2026, 'world')).toMatchObject({
      stops: [], legs: [],
      summary: { occurrenceCount: 0, stopCount: 0, legCount: 0, visitedCityCount: 0, visitedCountryCount: 0 },
    })
  })
})
