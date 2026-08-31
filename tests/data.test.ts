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

describe('iCalendar', () => {
  it('exports deterministically and round-trips supported fields', () => {
    const first = exportIcs(state.events, 'Работа')
    expect(exportIcs(state.events, 'Работа')).toBe(first)
    expect(first).toContain('DTSTART;VALUE=DATE:20260910')
    const imported = importIcs(first, 'target-cal', new Date('2026-09-01T00:00:00.000Z'))
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ title: 'Запуск, этап 1', description: 'Строка 1\nСтрока 2', startDate: '2026-09-10', endDateExclusive: '2026-09-13', calendarId: 'target-cal' })
    expect(imported[0].recurrence).toEqual({ frequency: 'yearly', interval: 1, until: '2028-09-10' })
  })

  it('rejects malformed events without returning partial results', () => {
    const input = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260230\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
    expect(() => importIcs(input, 'cal-1')).toThrow()
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

  it('rejects tampering before state construction', () => {
    const parsed = JSON.parse(createBackup(state))
    parsed.payload.events[0].title = '<img src=x onerror=alert(1)>'
    expect(() => previewBackup(JSON.stringify(parsed))).toThrow('Контрольная сумма')
  })

  it('rejects a correctly checksummed CSS URL calendar colour before restore', () => {
    const malicious = signedBackupWithColor('url(http://127.0.0.1:4999/leak)')
    expect(() => previewBackup(malicious)).toThrow('Повреждены календари')
  })
})
