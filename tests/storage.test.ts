import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { PlannerDatabase } from '../src/storage/idb'
import { PlannerStateSync, type BroadcastPortFactory } from '../src/storage/state-sync'
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

  it('loads the committed state in a second connection while the first tab remains open', async () => {
    const firstTab = await PlannerDatabase.open()
    const initial = await firstTab.load()
    const committed: PlannerState = {
      ...initial,
      events: [{ id: 'shared', calendarId: initial.calendars[0].id, title: 'Shared between tabs', description: '', startDate: '2026-09-02', endDateExclusive: '2026-09-03', allDay: true, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }],
    }
    await firstTab.save(committed)

    const secondTab = await PlannerDatabase.open()
    await expect(secondTab.load()).resolves.toEqual(committed)
    secondTab.close()
    firstTab.close()
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

  it('rejects an unknown city before a write transaction and preserves stored state', async () => {
    const database = await PlannerDatabase.open()
    const initial = await database.load()
    const unsafe: PlannerState = {
      ...initial,
      events: [{ id: 'unsafe-city', calendarId: initial.calendars[0].id, title: 'Unknown', description: '', startDate: '2026-09-01', endDateExclusive: '2026-09-02', allDay: true, cityId: 'unknown-city', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }],
    }

    await expect(database.save(unsafe)).rejects.toThrow('неизвестный город')
    await expect(database.load()).resolves.toEqual(initial)
    database.close()
  })
})

describe('cross-tab state invalidation', () => {
  it('broadcasts no calendar payload and accepts only the exact invalidation envelope', () => {
    let listener: ((event: MessageEvent<unknown>) => void) | undefined
    const sent: unknown[] = []
    let closes = 0
    let invalidations = 0
    const factory: BroadcastPortFactory = () => ({
      addEventListener: (_type, next) => { listener = next },
      removeEventListener: (_type, current) => { if (listener === current) listener = undefined },
      postMessage: (message) => { sent.push(message) },
      close: () => { closes += 1 },
    })
    const sync = new PlannerStateSync(() => { invalidations += 1 }, factory)

    sync.notifyChanged()
    expect(sent).toEqual([{ namespace: 'digitable-planner', version: 1, type: 'state-invalidated' }])
    expect(JSON.stringify(sent)).not.toContain('events')
    expect(JSON.stringify(sent)).not.toContain('calendars')

    listener?.({ data: sent[0] } as MessageEvent<unknown>)
    listener?.({ data: { ...sent[0] as object, payload: { events: ['secret'] } } } as MessageEvent<unknown>)
    listener?.({ data: { namespace: 'digitable-planner', version: 2, type: 'state-invalidated' } } as MessageEvent<unknown>)
    expect(invalidations).toBe(1)

    sync.close()
    sync.close()
    sync.notifyChanged()
    expect(closes).toBe(1)
    expect(sent).toHaveLength(1)
    expect(listener).toBeUndefined()
  })
})
