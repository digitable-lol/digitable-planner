import { describe, expect, it } from 'vitest'
import { createBackup, previewBackup, restoreAsCopy } from '../src/data/backup'
import { exportIcs, importIcs } from '../src/data/ical'
import type { PlannerState } from '../src/domain/types'

const state: PlannerState = {
  schemaVersion: 1,
  calendars: [{ id: 'cal-1', name: 'Работа', color: '#287271', visible: true, createdAt: '2026-01-01T00:00:00.000Z' }],
  events: [{
    id: 'event-1', calendarId: 'cal-1', title: 'Запуск, этап 1', description: 'Строка 1\nСтрока 2',
    startDate: '2026-09-10', endDateExclusive: '2026-09-13', allDay: true,
    recurrence: { frequency: 'yearly', interval: 1, until: '2028-09-10' },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-31T09:30:00.000Z',
  }],
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function signedBackupWithColor(color: string): string {
  const payload = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  const calendars = payload.calendars as Array<Record<string, unknown>>
  calendars[0].color = color
  return JSON.stringify({
    magic: 'DIGITABLE-PLANNER-BACKUP',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    checksum: fnv1a(JSON.stringify(payload)),
    payload,
  })
}

function signedBackupWithCity(cityId: string): string {
  const payload = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  const events = payload.events as Array<Record<string, unknown>>
  events[0].cityId = cityId
  return JSON.stringify({
    magic: 'DIGITABLE-PLANNER-BACKUP',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    checksum: fnv1a(JSON.stringify(payload)),
    payload,
  })
}

describe('iCalendar', () => {
  it('exports deterministically and round-trips supported fields', () => {
    const events = [{ ...state.events[0], cityId: 'moscow' }]
    const first = exportIcs(events, 'Работа')
    expect(exportIcs(events, 'Работа')).toBe(first)
    expect(first).toContain('DTSTART;VALUE=DATE:20260910')
    const imported = importIcs(first, 'target-cal', new Date('2026-09-01T00:00:00.000Z'))
    expect(imported).toHaveLength(1)
    expect(first).toContain('LOCATION:Москва\\, Россия')
    expect(first).toContain('X-DIGITABLE-CITY-ID:moscow')
    expect(imported[0]).toMatchObject({ title: 'Запуск, этап 1', description: 'Строка 1\nСтрока 2', startDate: '2026-09-10', endDateExclusive: '2026-09-13', calendarId: 'target-cal', cityId: 'moscow' })
    expect(imported[0].recurrence).toEqual({ frequency: 'yearly', interval: 1, until: '2028-09-10' })
  })

  it('rejects malformed events without returning partial results', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260230\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(() => importIcs(input, 'cal-1')).toThrow()
  })

  it('round-trips optional local start and end time without turning it into an all-day event', () => {
    const timed = { ...state.events[0], allDay: false, startTime: '09:30', endTime: '11:05' } as const
    const exported = exportIcs([timed])
    expect(exported).toContain('DTSTART:20260910T093000')
    expect(exported).toContain('DTEND:20260912T110500')
    expect(exported).not.toContain('DTSTART;VALUE=DATE:20260910')
    expect(importIcs(exported, 'cal-1')[0]).toMatchObject({
      allDay: false,
      startDate: '2026-09-10',
      endDateExclusive: '2026-09-13',
      startTime: '09:30',
      endTime: '11:05',
    })
  })

  it('imports a timed DTSTART without DTEND as an open-ended local slot', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:slot\r\nDTSTART:20260910T093000\r\nSUMMARY:Slot\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(importIcs(input, 'cal-1')[0]).toMatchObject({
      allDay: false,
      startDate: '2026-09-10',
      endDateExclusive: '2026-09-11',
      startTime: '09:30',
    })
    expect(importIcs(input, 'cal-1')[0].endTime).toBeUndefined()
  })

  it('rejects a local time slot whose ending is not after its start', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260910T110000\r\nDTEND:20260910T103000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(() => importIcs(input, 'cal-1')).toThrow('позже')
  })

  it('rejects timezone-bearing slots instead of silently changing their wall-clock time', () => {
    const withTimezone = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=Europe/Moscow:20260910T093000\r\nSUMMARY:Slot\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    const asUtc = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260910T063000Z\r\nSUMMARY:Slot\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(() => importIcs(withTimezone, 'cal-1')).toThrow('TZID')
    expect(() => importIcs(asUtc, 'cal-1')).toThrow('UTC')
  })

  it('accepts explicit VALUE=DATE-TIME when the value is floating local time', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE-TIME:20260910T093000\r\nDTEND;VALUE=DATE-TIME:20260910T110000\r\nSUMMARY:Slot\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(importIcs(input, 'cal-1')[0]).toMatchObject({ allDay: false, startTime: '09:30', endTime: '11:00' })
  })

  it('leaves an unknown external city id unbound instead of geocoding it', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:unknown\r\nDTSTART;VALUE=DATE:20260901\r\nSUMMARY:Trip\r\nLOCATION:Unknown place\r\nX-DIGITABLE-CITY-ID:not-in-catalogue\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(importIcs(input, 'cal-1')[0].cityId).toBeUndefined()
  })

  it('folds Cyrillic content by RFC 5545 UTF-8 octets without splitting characters', () => {
    const longTitle = 'Очень длинное название поездки '.repeat(8).trim()
    const exported = exportIcs([{ ...state.events[0], title: longTitle, cityId: 'saint-petersburg' }])
    for (const line of exported.split('\r\n').filter(Boolean)) {
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75)
    }
    expect(importIcs(exported, 'cal-1')[0].title).toBe(longTitle.slice(0, 300))
  })
})

describe('dplan backup', () => {
  it('previews a deterministic checked backup and restores as a copy', () => {
    const backup = createBackup(state, '2026-08-31T12:00:00.000Z')
    expect(createBackup(state, '2026-08-31T12:00:00.000Z')).toBe(backup)
    const preview = previewBackup(backup)
    expect(preview).toMatchObject({ calendars: 1, events: 1, earliest: '2026-09-10', latest: '2026-09-13' })
    const restored = restoreAsCopy(state, preview, new Date('2026-09-02T00:00:00.000Z'))
    expect(restored.calendars).toHaveLength(2)
    expect(restored.events).toHaveLength(2)
    expect(restored.calendars[1].name).toBe('Работа · копия')
    expect(restored.events[1].calendarId).toBe(restored.calendars[1].id)
  })

  it('restores copied calendars visible so their events appear immediately', () => {
    const hiddenSource: PlannerState = {
      ...state,
      calendars: state.calendars.map((calendar) => ({ ...calendar, visible: false })),
    }
    const preview = previewBackup(createBackup(hiddenSource))
    const restored = restoreAsCopy(state, preview, new Date('2026-09-02T00:00:00.000Z'))
    const copiedCalendar = restored.calendars.at(-1)!
    const copiedEvent = restored.events.at(-1)!

    expect(copiedCalendar.visible).toBe(true)
    expect(copiedEvent.calendarId).toBe(copiedCalendar.id)
  })

  it('keeps optional event time in a checked backup while accepting legacy all-day events', () => {
    const timed: PlannerState = {
      ...state,
      events: state.events.map((event) => ({ ...event, allDay: false, startTime: '09:30', endTime: '11:00' })),
    }
    const preview = previewBackup(createBackup(timed))
    expect(preview.envelope.payload.events[0]).toMatchObject({ allDay: false, startTime: '09:30', endTime: '11:00' })
    expect(previewBackup(createBackup(state)).envelope.payload.events[0].allDay).toBe(true)
  })

  it('rejects tampering before state construction', () => {
    const parsed = JSON.parse(createBackup(state))
    parsed.payload.events[0].title = '<img src=x onerror=alert(1)>'
    expect(() => previewBackup(JSON.stringify(parsed))).toThrow('Контрольная сумма')
  })

  it('rejects a correctly checksummed CSS URL calendar colour before restore', () => {
    const malicious = signedBackupWithColor('url(http://127.0.0.1:4999/leak)')
    expect(() => previewBackup(malicious)).toThrow('Повреждены календари')
  })

  it('rejects a correctly checksummed event with an unknown city id', () => {
    expect(() => previewBackup(signedBackupWithCity('attacker-controlled-city'))).toThrow('Повреждены события')
    expect(previewBackup(signedBackupWithCity('moscow')).events).toBe(1)
  })
})
