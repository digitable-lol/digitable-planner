import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { PlannerDatabase } from '../src/storage/idb'
import type { PlannerState } from '../src/domain/types'

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('digitable-planner')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

afterEach(() => deleteDatabase())

describe('IndexedDB repository', () => {
  it('creates the v1 schema and persists an atomic state across reopen', async () => {
    const database = await PlannerDatabase.open()
    const initial = await database.load()
    const state: PlannerState = {
      ...initial,
      events: [{ id: 'persisted', calendarId: initial.calendars[0].id, title: 'Reload me', description: '', startDate: '2026-09-01', endDateExclusive: '2026-09-02', allDay: true, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }],
    }
    await database.save(state)
    database.close()
    const reopened = await PlannerDatabase.open()
    await expect(reopened.load()).resolves.toEqual(state)
    reopened.close()
  })

  it('rejects an unsafe colour before a write transaction and preserves stored state', async () => {
    const database = await PlannerDatabase.open()
    const initial = await database.load()
    const unsafe = structuredClone(initial)
    ;(unsafe.calendars[0] as unknown as { color: string }).color = 'url(http://127.0.0.1:4999/leak)'

    await expect(database.save(unsafe)).rejects.toThrow('небезопасный цвет')
    await expect(database.load()).resolves.toEqual(initial)
    database.close()
  })
})
