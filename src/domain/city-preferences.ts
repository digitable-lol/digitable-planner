import { plannerCities, type PlannerCity } from '../data/cities'

export interface CityPickerPreferences {
  version: 1
  allowedCityIds: string[]
}

export interface RankedCity {
  city: PlannerCity
  usageCount: number
  selected: boolean
}

export interface CityPickerGroup {
  kind: 'used' | 'country'
  label: string
  cities: RankedCity[]
}

export interface RankSelectableCitiesInput {
  allowedCityIds: readonly string[]
  eventCityIds: readonly (string | null | undefined)[]
  selectedCityId?: string
  catalogue?: readonly PlannerCity[]
}

function byRussianName(left: PlannerCity, right: PlannerCity): number {
  return left.name.localeCompare(right.name, 'ru') || left.id.localeCompare(right.id)
}

function allCityIds(catalogue: readonly PlannerCity[]): string[] {
  return catalogue.map(({ id }) => id)
}

export function normalizeAllowedCityIds(
  value: unknown,
  catalogue: readonly PlannerCity[] = plannerCities,
): string[] {
  if (!Array.isArray(value)) return []
  const requested = new Set(value.filter((id): id is string => typeof id === 'string'))
  return catalogue.flatMap(({ id }) => requested.has(id) ? [id] : [])
}

export function parseCityPreferences(
  persisted: unknown,
  catalogue: readonly PlannerCity[] = plannerCities,
): CityPickerPreferences {
  if (persisted === null || persisted === undefined || persisted === '') {
    return { version: 1, allowedCityIds: allCityIds(catalogue) }
  }

  let value = persisted
  if (typeof persisted === 'string') {
    try { value = JSON.parse(persisted) }
    catch { return { version: 1, allowedCityIds: allCityIds(catalogue) } }
  }

  if (Array.isArray(value)) {
    return { version: 1, allowedCityIds: normalizeAllowedCityIds(value, catalogue) }
  }
  if (!value || typeof value !== 'object') {
    return { version: 1, allowedCityIds: allCityIds(catalogue) }
  }

  const candidate = value as { version?: unknown; allowedCityIds?: unknown }
  if (candidate.version !== undefined && candidate.version !== 1) {
    return { version: 1, allowedCityIds: allCityIds(catalogue) }
  }
  if (!Array.isArray(candidate.allowedCityIds)) {
    return { version: 1, allowedCityIds: allCityIds(catalogue) }
  }
  return { version: 1, allowedCityIds: normalizeAllowedCityIds(candidate.allowedCityIds, catalogue) }
}

export function serializeCityPreferences(
  allowedCityIds: readonly string[],
  catalogue: readonly PlannerCity[] = plannerCities,
): string {
  const preferences: CityPickerPreferences = {
    version: 1,
    allowedCityIds: normalizeAllowedCityIds(allowedCityIds, catalogue),
  }
  return JSON.stringify(preferences)
}

export function rankSelectableCities({
  allowedCityIds,
  eventCityIds,
  selectedCityId,
  catalogue = plannerCities,
}: RankSelectableCitiesInput): RankedCity[] {
  const cityById = new Map(catalogue.map((city) => [city.id, city]))
  const included = new Set(normalizeAllowedCityIds(allowedCityIds, catalogue))
  const usage = new Map<string, number>()

  for (const cityId of eventCityIds) {
    if (!cityId || !cityById.has(cityId)) continue
    included.add(cityId)
    usage.set(cityId, (usage.get(cityId) ?? 0) + 1)
  }
  if (selectedCityId && cityById.has(selectedCityId)) included.add(selectedCityId)

  return catalogue
    .filter(({ id }) => included.has(id))
    .map((city) => ({
      city,
      usageCount: usage.get(city.id) ?? 0,
      selected: city.id === selectedCityId,
    }))
    .sort((left, right) => right.usageCount - left.usageCount || byRussianName(left.city, right.city))
}

export function groupRankedCities(rankedCities: readonly RankedCity[]): CityPickerGroup[] {
  const groups: CityPickerGroup[] = []
  const used = rankedCities.filter(({ usageCount }) => usageCount > 0)
  if (used.length) groups.push({ kind: 'used', label: 'Используемые', cities: [...used] })

  const unusedByCountry = new Map<string, RankedCity[]>()
  for (const item of rankedCities) {
    if (item.usageCount > 0) continue
    const country = item.city.country
    unusedByCountry.set(country, [...(unusedByCountry.get(country) ?? []), item])
  }
  const countries = [...unusedByCountry.keys()].sort((left, right) => {
    if (left === 'Россия') return -1
    if (right === 'Россия') return 1
    return left.localeCompare(right, 'ru')
  })
  for (const country of countries) {
    groups.push({
      kind: 'country',
      label: country,
      cities: unusedByCountry.get(country)!.sort((left, right) => byRussianName(left.city, right.city)),
    })
  }
  return groups
}
