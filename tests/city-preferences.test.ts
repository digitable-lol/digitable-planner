import { describe, expect, it } from 'vitest'
import { plannerCities } from '../src/data/cities'
import {
  groupRankedCities,
  normalizeAllowedCityIds,
  parseCityPreferences,
  rankSelectableCities,
  serializeCityPreferences,
} from '../src/domain/city-preferences'

const compactCatalogue = plannerCities.filter(({ id }) => [
  'moscow',
  'ivanovo',
  'cheboksary',
  'berlin',
  'paris',
].includes(id))

describe('city picker preferences', () => {
  it('normalizes allowed ids against the catalogue in deterministic catalogue order', () => {
    expect(normalizeAllowedCityIds(['paris', 'unknown', 'moscow', 'paris', 42], compactCatalogue))
      .toEqual(['moscow', 'paris'])
  })

  it('uses the full local catalogue when persisted preferences are absent or malformed', () => {
    const expected = compactCatalogue.map(({ id }) => id)
    expect(parseCityPreferences(null, compactCatalogue).allowedCityIds).toEqual(expected)
    expect(parseCityPreferences('{broken', compactCatalogue).allowedCityIds).toEqual(expected)
  })

  it('round-trips a normalized persisted allowlist and preserves an intentional empty list', () => {
    const stored = serializeCityPreferences(['paris', 'unknown', 'ivanovo', 'paris'], compactCatalogue)
    expect(parseCityPreferences(stored, compactCatalogue)).toEqual({ version: 1, allowedCityIds: ['ivanovo', 'paris'] })
    expect(parseCityPreferences('{"version":1,"allowedCityIds":[]}', compactCatalogue).allowedCityIds).toEqual([])
  })

  it('ranks used cities first by descending frequency and Russian locale name on ties', () => {
    const ranked = rankSelectableCities({
      allowedCityIds: compactCatalogue.map(({ id }) => id),
      eventCityIds: ['paris', 'moscow', 'paris', 'ivanovo', 'moscow', 'berlin'],
      catalogue: compactCatalogue,
    })

    expect(ranked.map(({ city }) => city.id)).toEqual(['moscow', 'paris', 'berlin', 'ivanovo', 'cheboksary'])
    expect(ranked.map(({ usageCount }) => usageCount)).toEqual([2, 2, 1, 1, 0])
  })

  it('includes used cities outside the allowlist while excluding unused cities outside it', () => {
    const ranked = rankSelectableCities({
      allowedCityIds: ['ivanovo'],
      eventCityIds: ['berlin', 'berlin', 'unknown'],
      catalogue: compactCatalogue,
    })

    expect(ranked.map(({ city }) => city.id)).toEqual(['berlin', 'ivanovo'])
  })

  it('keeps a known selected city selectable outside the allowlist and ignores an unknown selection', () => {
    const selected = rankSelectableCities({
      allowedCityIds: ['ivanovo'],
      eventCityIds: [],
      selectedCityId: 'paris',
      catalogue: compactCatalogue,
    })
    const unknown = rankSelectableCities({
      allowedCityIds: ['ivanovo'],
      eventCityIds: [],
      selectedCityId: 'unknown',
      catalogue: compactCatalogue,
    })

    expect(selected.map(({ city }) => city.id)).toEqual(['ivanovo', 'paris'])
    expect(unknown.map(({ city }) => city.id)).toEqual(['ivanovo'])
  })

  it('groups used cities first, then unused cities by country without duplicates', () => {
    const groups = groupRankedCities(rankSelectableCities({
      allowedCityIds: compactCatalogue.map(({ id }) => id),
      eventCityIds: ['paris', 'moscow', 'paris'],
      catalogue: compactCatalogue,
    }))

    expect(groups.map(({ label }) => label)).toEqual(['Используемые', 'Россия', 'Германия'])
    expect(groups[0].cities.map(({ city }) => city.id)).toEqual(['paris', 'moscow'])
    expect(groups[1].cities.map(({ city }) => city.id)).toEqual(['ivanovo', 'cheboksary'])
    expect(groups.flatMap(({ cities }) => cities.map(({ city }) => city.id))).toHaveLength(5)
  })
})
