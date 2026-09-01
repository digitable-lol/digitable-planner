import { parseLocalDate, todayLocal } from './dates'
import type { LocalDate } from './types'

export type PeriodScope = 'year' | 'future' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom'

const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

function normalizedCustomMonths(months: readonly number[]): number[] {
  if (months.some((month) => !Number.isInteger(month) || month < 0 || month > 11)) {
    throw new Error('Номер месяца должен быть от 0 до 11')
  }
  return [...new Set(months)].sort((a, b) => a - b)
}

export function activeMonthIndexes(
  year: number,
  scope: PeriodScope,
  customMonths: readonly number[],
  today: LocalDate = todayLocal(),
): number[] {
  const current = parseLocalDate(today)
  if (scope === 'year') return [...ALL_MONTHS]
  if (scope === 'custom') return normalizedCustomMonths(customMonths)
  if (scope === 'future') {
    const currentYear = current.getUTCFullYear()
    if (year < currentYear) return []
    if (year > currentYear) return [...ALL_MONTHS]
    return ALL_MONTHS.filter((month) => month >= current.getUTCMonth())
  }
  const quarter = Number(scope.slice(1))
  const start = (quarter - 1) * 3
  return [start, start + 1, start + 2]
}

export function isDateInScope(
  date: LocalDate,
  year: number,
  scope: PeriodScope,
  customMonths: readonly number[],
  today: LocalDate = todayLocal(),
): boolean {
  const parsed = parseLocalDate(date)
  if (parsed.getUTCFullYear() !== year) return false
  if (scope === 'future' && date < today) return false
  return activeMonthIndexes(year, scope, customMonths, today).includes(parsed.getUTCMonth())
}
