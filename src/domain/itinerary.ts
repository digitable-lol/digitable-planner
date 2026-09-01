import type { PlannerCity } from '../data/cities'
import { cityEventGroups } from './city-map'
import type { LocalDate, PlannerEvent, PlannerState } from './types'

export type TravelLevel = 'world' | 'russia'

export interface ItineraryStop {
  number: number
  city: PlannerCity
  occurrences: PlannerEvent[]
  arrivalDate: LocalDate
  departureDateExclusive: LocalDate
}

export interface ItineraryLeg {
  number: number
  from: ItineraryStop
  to: ItineraryStop
}

export interface TravelSummary {
  level: TravelLevel
  occurrenceCount: number
  stopCount: number
  legCount: number
  visitedCityCount: number
  visitedCountryCount: number
  visitedCities: PlannerCity[]
  visitedCountries: string[]
}

export interface TravelItinerary {
  year: number
  level: TravelLevel
  stops: ItineraryStop[]
  legs: ItineraryLeg[]
  summary: TravelSummary
}

interface CityOccurrence {
  city: PlannerCity
  event: PlannerEvent
}

function compareOccurrences(left: CityOccurrence, right: CityOccurrence): number {
  return left.event.startDate.localeCompare(right.event.startDate)
    || (left.event.startTime ?? '').localeCompare(right.event.startTime ?? '')
    || left.event.id.localeCompare(right.event.id)
}

function stopFor(number: number, city: PlannerCity, occurrences: PlannerEvent[]): ItineraryStop {
  return {
    number,
    city,
    occurrences,
    arrivalDate: occurrences[0].startDate,
    departureDateExclusive: occurrences.reduce(
      (latest, event) => event.endDateExclusive > latest ? event.endDateExclusive : latest,
      occurrences[0].endDateExclusive,
    ),
  }
}

export function deriveItinerary(state: PlannerState, year: number, level: TravelLevel): TravelItinerary {
  const ordered = cityEventGroups(state, year)
    .flatMap(({ city, occurrences }) => occurrences.map((event) => ({ city, event })))
    .filter(({ city }) => level === 'world' || city.country === 'Россия')
    .sort(compareOccurrences)

  const stops: ItineraryStop[] = []
  for (const occurrence of ordered) {
    const previous = stops.at(-1)
    if (previous?.city.id === occurrence.city.id) {
      previous.occurrences.push(occurrence.event)
      if (occurrence.event.endDateExclusive > previous.departureDateExclusive) {
        previous.departureDateExclusive = occurrence.event.endDateExclusive
      }
      continue
    }
    stops.push(stopFor(stops.length + 1, occurrence.city, [occurrence.event]))
  }

  const legs = stops.slice(1).map((to, index): ItineraryLeg => ({
    number: index + 1,
    from: stops[index],
    to,
  }))
  const visitedCities = [...new Map(stops.map(({ city }) => [city.id, city])).values()]
  const visitedCountries = [...new Set(visitedCities.map(({ country }) => country))]
  const occurrenceCount = stops.reduce((total, stop) => total + stop.occurrences.length, 0)
  const summary: TravelSummary = {
    level,
    occurrenceCount,
    stopCount: stops.length,
    legCount: legs.length,
    visitedCityCount: visitedCities.length,
    visitedCountryCount: visitedCountries.length,
    visitedCities,
    visitedCountries,
  }

  return { year, level, stops, legs, summary }
}
