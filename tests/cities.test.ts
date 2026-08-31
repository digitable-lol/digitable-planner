import { describe, expect, it } from 'vitest'
import { getCity, plannerCities, projectCity } from '../src/data/cities'
import { cityEventGroups } from '../src/domain/city-map'
import type { PlannerState } from '../src/domain/types'

describe('offline city catalogue', () => {
  it('uses unique stable ids, valid coordinates, and supported time zones', () => {
    expect(new Set(plannerCities.map(({ id }) => id)).size).toBe(plannerCities.length)
    for (const city of plannerCities) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90)
      expect(city.latitude).toBeLessThanOrEqual(90)
      expect(city.longitude).toBeGreaterThanOrEqual(-180)
      expect(city.longitude).toBeLessThanOrEqual(180)
      expect(() => new Intl.DateTimeFormat('ru-RU', { timeZone: city.timeZone })).not.toThrow()
      expect(getCity(city.id)).toEqual(city)
    }
  })

  it('projects every city inside the local map viewBox', () => {
    for (const city of plannerCities) {
      const point = projectCity(city)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(1000)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(500)
    }
  })

  it('groups only visible occurrences from the selected year', () => {
    const state: PlannerState = {
      schemaVersion: 1,
      calendars: [
        { id: 'shown', name: 'Shown', color: '#40e0d0', visible: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'hidden', name: 'Hidden', color: '#69a7ff', visible: false, createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      events: [
        { id: 'trip', calendarId: 'shown', title: 'Trip', description: '', startDate: '2025-09-01', endDateExclusive: '2025-09-02', allDay: true, recurrence: { frequency: 'yearly', interval: 1 }, cityId: 'tbilisi', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
        { id: 'hidden', calendarId: 'hidden', title: 'Hidden', description: '', startDate: '2026-09-01', endDateExclusive: '2026-09-02', allDay: true, cityId: 'berlin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    }

    const groups = cityEventGroups(state, 2026)
    expect(groups).toHaveLength(1)
    expect(groups[0].city.id).toBe('tbilisi')
    expect(groups[0].occurrences.map(({ startDate }) => startDate)).toEqual(['2026-09-01'])
  })
})
