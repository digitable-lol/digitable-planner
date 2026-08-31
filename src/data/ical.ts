import { addDays, formatLocalDate, parseLocalDate } from '../domain/dates'
import type { LocalDate, PlannerEvent } from '../domain/types'

const MAX_ICS_BYTES = 2_000_000
const MAX_EVENTS = 5_000

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) => char.toLowerCase() === 'n' ? '\n' : char)
}

function icalDate(value: LocalDate): string {
  return value.replaceAll('-', '')
}

function localFromIcal(value: string): LocalDate {
  if (!/^\d{8}$/.test(value)) throw new Error(`Неподдерживаемая дата: ${value}`)
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` as LocalDate
  parseLocalDate(date)
  return date
}

function fold(line: string): string {
  const chunks: string[] = []
  let remaining = line
  while (remaining.length > 73) {
    chunks.push(remaining.slice(0, 73))
    remaining = ` ${remaining.slice(73)}`
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

export function exportIcs(events: PlannerEvent[], calendarName = 'Digitable Planner'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digitable//Planner 0.1//RU',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]
  for (const event of [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))) {
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.id)}@planner.digitable.life`)
    lines.push(`DTSTAMP:${event.updatedAt.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`)
    lines.push(`DTSTART;VALUE=DATE:${icalDate(event.startDate)}`, `DTEND;VALUE=DATE:${icalDate(event.endDateExclusive)}`)
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.recurrence) {
      const rule = [`FREQ=${event.recurrence.frequency.toUpperCase()}`, `INTERVAL=${event.recurrence.interval}`]
      if (event.recurrence.until) rule.push(`UNTIL=${icalDate(event.recurrence.until)}`)
      lines.push(`RRULE:${rule.join(';')}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

interface ParsedFields { [key: string]: string }

export function importIcs(input: string, calendarId: string, now = new Date()): PlannerEvent[] {
  if (new Blob([input]).size > MAX_ICS_BYTES) throw new Error('ICS-файл больше 2 МБ')
  const unfolded = input.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  if (!unfolded.includes('BEGIN:VCALENDAR') || !unfolded.includes('END:VCALENDAR')) throw new Error('Некорректный VCALENDAR')
  const events: PlannerEvent[] = []
  let current: ParsedFields | undefined
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue }
    if (line === 'END:VEVENT') {
      if (!current) throw new Error('Некорректная структура VEVENT')
      const startRaw = current.DTSTART
      if (!startRaw) throw new Error('VEVENT без DTSTART')
      const startDate = localFromIcal(startRaw)
      const endDateExclusive = current.DTEND ? localFromIcal(current.DTEND) : addDays(startDate, 1)
      if (endDateExclusive <= startDate) throw new Error('DTEND должен быть позже DTSTART')
      const id = (current.UID?.split('@')[0] || crypto.randomUUID()).slice(0, 160)
      const recurrence = parseRecurrence(current.RRULE)
      events.push({
        id: events.some((event) => event.id === id) ? `${id}-${events.length}` : id,
        calendarId,
        title: unescapeText(current.SUMMARY || 'Без названия').slice(0, 300),
        description: unescapeText(current.DESCRIPTION || '').slice(0, 10_000),
        startDate,
        endDateExclusive,
        allDay: true,
        ...(recurrence ? { recurrence } : {}),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      if (events.length > MAX_EVENTS) throw new Error('ICS содержит больше 5000 событий')
      current = undefined
      continue
    }
    if (current) {
      const separator = line.indexOf(':')
      if (separator < 1) continue
      const key = line.slice(0, separator).split(';')[0]
      if (['UID', 'DTSTART', 'DTEND', 'SUMMARY', 'DESCRIPTION', 'RRULE'].includes(key)) current[key] = line.slice(separator + 1)
    }
  }
  if (current) throw new Error('Незакрытый VEVENT')
  return events
}

function parseRecurrence(value?: string): PlannerEvent['recurrence'] | undefined {
  if (!value) return undefined
  const fields = Object.fromEntries(value.split(';').map((pair) => pair.split('=', 2)))
  const frequency = fields.FREQ?.toLowerCase()
  if (!['weekly', 'monthly', 'yearly'].includes(frequency)) return undefined
  const interval = Number(fields.INTERVAL || 1)
  if (!Number.isInteger(interval) || interval < 1 || interval > 100) throw new Error('Некорректный RRULE INTERVAL')
  const until = fields.UNTIL ? localFromIcal(fields.UNTIL.slice(0, 8)) : undefined
  return { frequency: frequency as 'weekly' | 'monthly' | 'yearly', interval, ...(until ? { until } : {}) }
}

export function dateStamp(date: LocalDate): string {
  return formatLocalDate(parseLocalDate(date))
}
