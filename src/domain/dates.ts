import type { LocalDate, PlannerEvent } from './types'

export function localDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as LocalDate
}

export function parseLocalDate(value: LocalDate | string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Некорректная дата: ${value}`)
  const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (formatLocalDate(result) !== value) throw new Error(`Несуществующая дата: ${value}`)
  return result
}

export function formatLocalDate(value: Date): LocalDate {
  return localDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
}

export function addDays(value: LocalDate, amount: number): LocalDate {
  const date = parseLocalDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatLocalDate(date)
}

export function addMonths(value: LocalDate, amount: number): LocalDate {
  const date = parseLocalDate(value)
  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + amount)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(originalDay, lastDay))
  return formatLocalDate(date)
}

export function addYears(value: LocalDate, amount: number): LocalDate {
  const date = parseLocalDate(value)
  const month = date.getUTCMonth()
  date.setUTCFullYear(date.getUTCFullYear() + amount)
  if (date.getUTCMonth() !== month) date.setUTCDate(0)
  return formatLocalDate(date)
}

export function daysBetween(start: LocalDate, end: LocalDate): number {
  return Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86_400_000)
}

export function dateRange(start: LocalDate, endExclusive: LocalDate): LocalDate[] {
  const length = daysBetween(start, endExclusive)
  if (length < 1 || length > 3_660) throw new Error('Интервал события должен быть от 1 дня до 10 лет')
  return Array.from({ length }, (_, index) => addDays(start, index))
}

export function overlapsDate(event: PlannerEvent, date: LocalDate): boolean {
  return event.startDate <= date && event.endDateExclusive > date
}

export function todayLocal(): LocalDate {
  const now = new Date()
  return localDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function isWeekend(date: LocalDate): boolean {
  const day = parseLocalDate(date).getUTCDay()
  return day === 0 || day === 6
}
