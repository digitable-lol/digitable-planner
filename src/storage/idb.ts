import { assertSafeCalendarColors, blankState, type PlannerCalendar, type PlannerEvent, type PlannerState } from '../domain/types'
import { getCity } from '../data/cities'

const DB_NAME = 'digitable-planner'
const DB_VERSION = 1
const CALENDARS = 'calendars'
const EVENTS = 'events'

function assertSafeEventCities(state: Pick<PlannerState, 'events'>): void {
  if (!state.events.every((event) => event.cityId === undefined || Boolean(getCity(event.cityId)))) {
    throw new Error('Обнаружен неизвестный город события')
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export class PlannerDatabase {
  private constructor(private readonly database: IDBDatabase) {}

  static async open(factory: IDBFactory = indexedDB): Promise<PlannerDatabase> {
    const request = factory.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const database = request.result
      if ((event as IDBVersionChangeEvent).oldVersion < 1) {
        database.createObjectStore(CALENDARS, { keyPath: 'id' })
        const events = database.createObjectStore(EVENTS, { keyPath: 'id' })
        events.createIndex('calendarId', 'calendarId')
        events.createIndex('startDate', 'startDate')
      }
      // Future migrations are appended here and keyed by oldVersion.
    }
    return new PlannerDatabase(await requestResult(request))
  }

  async load(): Promise<PlannerState> {
    const transaction = this.database.transaction([CALENDARS, EVENTS], 'readonly')
    const calendarsRequest = transaction.objectStore(CALENDARS).getAll() as IDBRequest<PlannerCalendar[]>
    const eventsRequest = transaction.objectStore(EVENTS).getAll() as IDBRequest<PlannerEvent[]>
    const [calendars, events] = await Promise.all([requestResult(calendarsRequest), requestResult(eventsRequest)])
    await transactionComplete(transaction)
    if (!calendars.length) {
      const initial = blankState()
      await this.save(initial)
      return initial
    }
    const state: PlannerState = {
      schemaVersion: 1,
      calendars: calendars.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      events: events.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)),
    }
    assertSafeCalendarColors(state)
    assertSafeEventCities(state)
    return state
  }

  async save(state: PlannerState): Promise<void> {
    assertSafeCalendarColors(state)
    assertSafeEventCities(state)
    const transaction = this.database.transaction([CALENDARS, EVENTS], 'readwrite')
    const calendars = transaction.objectStore(CALENDARS)
    const events = transaction.objectStore(EVENTS)
    calendars.clear()
    events.clear()
    state.calendars.forEach((calendar) => calendars.put(calendar))
    state.events.forEach((event) => events.put(event))
    await transactionComplete(transaction)
  }

  close(): void {
    this.database.close()
  }
}
