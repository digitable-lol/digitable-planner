import { parseLocalDate } from '../domain/dates'
import { assertSafeCalendarColors, isCalendarColor, validateEventTiming, type PlannerCalendar, type PlannerEvent, type PlannerState } from '../domain/types'
import { getCity } from './cities'

const MAGIC = 'DIGITABLE-PLANNER-BACKUP'
const VERSION = 1
const MAX_BACKUP_BYTES = 5_000_000

export interface BackupEnvelope {
  magic: typeof MAGIC
  version: typeof VERSION
  createdAt: string
  checksum: string
  payload: PlannerState
}

export interface RestorePreview {
  envelope: BackupEnvelope
  calendars: number
  events: number
  earliest?: string
  latest?: string
}

function stableState(state: PlannerState): PlannerState {
  return {
    schemaVersion: 1,
    calendars: [...state.calendars].sort((a, b) => a.id.localeCompare(b.id)),
    events: [...state.events].sort((a, b) => a.id.localeCompare(b.id)),
  }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function validateCalendar(value: unknown): value is PlannerCalendar {
  if (!value || typeof value !== 'object') return false
  const calendar = value as Record<string, unknown>
  return ['id', 'name', 'createdAt'].every((key) => typeof calendar[key] === 'string')
    && isCalendarColor(calendar.color)
    && typeof calendar.visible === 'boolean'
}

function validateEvent(value: unknown, calendarIds: Set<string>): value is PlannerEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  if (!['id', 'calendarId', 'title', 'description', 'startDate', 'endDateExclusive', 'createdAt', 'updatedAt']
    .every((key) => typeof event[key] === 'string')) return false
  if (typeof event.allDay !== 'boolean' || !calendarIds.has(event.calendarId as string)) return false
  if (event.cityId !== undefined && (typeof event.cityId !== 'string' || !getCity(event.cityId))) return false
  try {
    parseLocalDate(event.startDate as string)
    parseLocalDate(event.endDateExclusive as string)
    validateEventTiming(event as unknown as PlannerEvent)
  } catch { return false }
  return (event.startDate as string) < (event.endDateExclusive as string)
}

export function createBackup(state: PlannerState, createdAt = new Date().toISOString()): string {
  assertSafeCalendarColors(state)
  const payload = stableState(state)
  const checksum = fnv1a(JSON.stringify(payload))
  const envelope: BackupEnvelope = { magic: MAGIC, version: VERSION, createdAt, checksum, payload }
  return `${JSON.stringify(envelope, null, 2)}\n`
}

export function previewBackup(input: string): RestorePreview {
  if (new Blob([input]).size > MAX_BACKUP_BYTES) throw new Error('Резервная копия больше 5 МБ')
  let raw: unknown
  try { raw = JSON.parse(input) } catch { throw new Error('Это не JSON-файл резервной копии') }
  if (!raw || typeof raw !== 'object') throw new Error('Некорректная резервная копия')
  const envelope = raw as Partial<BackupEnvelope>
  if (envelope.magic !== MAGIC || envelope.version !== VERSION || !envelope.payload) {
    throw new Error('Неподдерживаемый формат резервной копии')
  }
  const payload = envelope.payload as PlannerState
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.calendars) || !Array.isArray(payload.events)) {
    throw new Error('Некорректная структура резервной копии')
  }
  if (!payload.calendars.every(validateCalendar)) throw new Error('Повреждены календари')
  const calendarIds = new Set(payload.calendars.map(({ id }) => id))
  if (!payload.events.every((event) => validateEvent(event, calendarIds))) throw new Error('Повреждены события')
  if (fnv1a(JSON.stringify(stableState(payload))) !== envelope.checksum) throw new Error('Контрольная сумма не совпадает')
  const dates = payload.events.flatMap((event) => [event.startDate, event.endDateExclusive]).sort()
  return {
    envelope: envelope as BackupEnvelope,
    calendars: payload.calendars.length,
    events: payload.events.length,
    earliest: dates[0],
    latest: dates.at(-1),
  }
}

export function restoreAsCopy(current: PlannerState, preview: RestorePreview, now = new Date()): PlannerState {
  assertSafeCalendarColors(current)
  assertSafeCalendarColors(preview.envelope.payload)
  const suffix = now.getTime().toString(36)
  const calendarMap = new Map<string, string>()
  const calendars = preview.envelope.payload.calendars.map((calendar, index) => {
    const id = `restore-${suffix}-${index}`
    calendarMap.set(calendar.id, id)
    return { ...calendar, id, name: `${calendar.name} · копия`, visible: true, createdAt: now.toISOString() }
  })
  const events = preview.envelope.payload.events.map((event, index) => ({
    ...event,
    id: `restore-event-${suffix}-${index}`,
    calendarId: calendarMap.get(event.calendarId)!,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }))
  return { ...current, calendars: [...current.calendars, ...calendars], events: [...current.events, ...events] }
}
