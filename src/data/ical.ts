import { addDays, formatLocalDate, parseLocalDate } from '../domain/dates'
import { parseLocalTime, validateEventTiming, type LocalDate, type LocalTime, type PlannerEvent } from '../domain/types'
import { getCity } from './cities'

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

function icalTime(value: LocalTime): string {
  return `${value.replace(':', '')}00`
}

function localFromIcal(value: string): LocalDate {
  if (!/^\d{8}$/.test(value)) throw new Error(`Неподдерживаемая дата: ${value}`)
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` as LocalDate
  parseLocalDate(date)
  return date
}

function localDateTimeFromIcal(value: string): { date: LocalDate; time: LocalTime } {
  const match = /^(\d{8})T(\d{2})(\d{2})(?:\d{2})?$/.exec(value)
  if (!match) throw new Error(`Неподдерживаемые локальные дата и время: ${value}`)
  return { date: localFromIcal(match[1]), time: parseLocalTime(`${match[2]}:${match[3]}`) }
}

function fold(line: string): string {
  const chunks: string[] = []
  const encoder = new TextEncoder()
  let current = ''
  let limit = 75
  for (const character of line) {
    if (current && encoder.encode(current + character).byteLength > limit) {
      chunks.push(current)
      current = character
      limit = 74 // Continuation lines start with one folding-space octet.
    } else {
      current += character
    }
  }
  chunks.push(current)
  return chunks.join('\r\n ')
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
    validateEventTiming(event)
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.id)}@planner.digitable.life`)
    lines.push(`DTSTAMP:${event.updatedAt.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`)
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icalDate(event.startDate)}`, `DTEND;VALUE=DATE:${icalDate(event.endDateExclusive)}`)
    } else {
      lines.push(`DTSTART:${icalDate(event.startDate)}T${icalTime(event.startTime!)}`)
      if (event.endTime) {
        lines.push(`DTEND:${icalDate(addDays(event.endDateExclusive, -1))}T${icalTime(event.endTime)}`)
      }
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    const city = getCity(event.cityId)
    if (city) {
      lines.push(`LOCATION:${escapeText(`${city.name}, ${city.country}`)}`)
      lines.push(`X-DIGITABLE-CITY-ID:${city.id}`)
    }
    if (event.recurrence) {
      const rule = [`FREQ=${event.recurrence.frequency.toUpperCase()}`, `INTERVAL=${event.recurrence.interval}`]
      if (event.recurrence.until) {
        rule.push(`UNTIL=${icalDate(event.recurrence.until)}${event.allDay ? '' : `T${icalTime(event.startTime!)}`}`)
      }
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
      if (current['UNSUPPORTED-DATETIME-PARAMS']) throw new Error('TZID и UTC-время пока не поддерживаются: импортируйте floating local или событие на весь день')
      const startRaw = current.DTSTART
      if (!startRaw) throw new Error('VEVENT без DTSTART')
      if (startRaw.endsWith('Z') || current.DTEND?.endsWith('Z')) {
        throw new Error('UTC-время пока не поддерживается: импортируйте floating local или событие на весь день')
      }
      const allDay = /^\d{8}$/.test(startRaw)
      const start = allDay ? { date: localFromIcal(startRaw), time: undefined } : localDateTimeFromIcal(startRaw)
      let endDateExclusive: LocalDate
      let endTime: LocalTime | undefined
      if (current.DTEND) {
        if (allDay) {
          if (!/^\d{8}$/.test(current.DTEND)) throw new Error('DTSTART и DTEND должны иметь одинаковый тип')
          endDateExclusive = localFromIcal(current.DTEND)
        } else {
          const end = localDateTimeFromIcal(current.DTEND)
          endDateExclusive = addDays(end.date, 1)
          endTime = end.time
        }
      } else {
        endDateExclusive = addDays(start.date, 1)
      }
      if (endDateExclusive <= start.date) throw new Error('DTEND должен быть позже DTSTART')
      const id = (current.UID?.split('@')[0] || crypto.randomUUID()).slice(0, 160)
      const recurrence = parseRecurrence(current.RRULE)
      const city = getCity(current['X-DIGITABLE-CITY-ID'])
      events.push({
        id: events.some((event) => event.id === id) ? `${id}-${events.length}` : id,
        calendarId,
        title: unescapeText(current.SUMMARY || 'Без названия').slice(0, 300),
        description: unescapeText(current.DESCRIPTION || '').slice(0, 10_000),
        startDate: start.date,
        endDateExclusive,
        allDay,
        ...(!allDay ? { startTime: start.time, ...(endTime ? { endTime } : {}) } : {}),
        ...(recurrence ? { recurrence } : {}),
        ...(city ? { cityId: city.id } : {}),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      validateEventTiming(events.at(-1)!)
      if (events.length > MAX_EVENTS) throw new Error('ICS содержит больше 5000 событий')
      current = undefined
      continue
    }
    if (current) {
      const separator = line.indexOf(':')
      if (separator < 1) continue
      const property = line.slice(0, separator)
      const [key, ...parameters] = property.split(';')
      const supportedDateTimeParameters = new Set(['VALUE=DATE', 'VALUE=DATE-TIME'])
      if ((key === 'DTSTART' || key === 'DTEND') && parameters.some((parameter) => !supportedDateTimeParameters.has(parameter))) {
        current['UNSUPPORTED-DATETIME-PARAMS'] = property
      }
      if (['UID', 'DTSTART', 'DTEND', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'RRULE', 'X-DIGITABLE-CITY-ID'].includes(key)) current[key] = line.slice(separator + 1)
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
