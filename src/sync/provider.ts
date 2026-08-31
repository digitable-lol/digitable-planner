import type { PlannerEvent } from '../domain/types'

export type ProviderCapability = 'SUPPORTED' | 'PARTIAL' | 'BLOCKED' | 'UNVERIFIED'

export interface CalendarProviderPort {
  readonly id: string
  readonly capability: ProviderCapability
  pull(): Promise<PlannerEvent[]>
  push(_events: PlannerEvent[]): Promise<void>
}

export const providerCapabilities = [
  {
    id: 'caldav',
    title: 'CalDAV',
    status: 'UNVERIFIED' as const,
    detail: 'NOT IMPLEMENTED — браузерная CORS-совместимость и конфликты ещё не доказаны.',
  },
  {
    id: 'icloud',
    title: 'iCloud Calendar',
    status: 'UNVERIFIED' as const,
    detail: 'NOT IMPLEMENTED — учётные данные не запрашиваются и не сохраняются.',
  },
]
