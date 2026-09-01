export type LocalDate = `${number}-${number}-${number}`
export type CalendarColor = `#${string}`

const CALENDAR_COLOR_PATTERN = /^#[0-9a-f]{6}$/

export function isCalendarColor(value: unknown): value is CalendarColor {
  return typeof value === 'string' && CALENDAR_COLOR_PATTERN.test(value)
}

export function parseCalendarColor(value: unknown): CalendarColor {
  if (!isCalendarColor(value)) throw new Error('Цвет календаря должен быть в формате #rrggbb')
  return value
}

export interface PlannerCalendar {
  id: string
  name: string
  color: CalendarColor
  visible: boolean
  createdAt: string
}

export type Recurrence =
  | { frequency: 'weekly'; interval: number; until?: LocalDate }
  | { frequency: 'monthly'; interval: number; until?: LocalDate }
  | { frequency: 'yearly'; interval: number; until?: LocalDate }

export interface PlannerEvent {
  id: string
  calendarId: string
  title: string
  description: string
  startDate: LocalDate
  endDateExclusive: LocalDate
  allDay: true
  recurrence?: Recurrence
  cityId?: string
  createdAt: string
  updatedAt: string
}

export interface PlannerState {
  schemaVersion: 1
  calendars: PlannerCalendar[]
  events: PlannerEvent[]
}

export function updateCalendarDetails(state: PlannerState, calendarId: string, name: string, color: CalendarColor): PlannerState {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('Введите название календаря')
  if (!state.calendars.some((calendar) => calendar.id === calendarId)) throw new Error('Календарь не найден')
  return {
    ...state,
    calendars: state.calendars.map((calendar) => calendar.id === calendarId
      ? { ...calendar, name: normalizedName, color }
      : calendar),
  }
}

export function deleteCalendar(state: PlannerState, calendarId: string): PlannerState {
  if (!state.calendars.some((calendar) => calendar.id === calendarId)) throw new Error('Календарь не найден')
  if (state.calendars.length === 1) throw new Error('Нельзя удалить единственный календарь')
  return {
    ...state,
    calendars: state.calendars.filter((calendar) => calendar.id !== calendarId),
    events: state.events.filter((event) => event.calendarId !== calendarId),
  }
}

export const PALETTE = ['#40e0d0', '#69a7ff', '#75d69c', '#b58cff', '#ffad66', '#ff7d86'] as const satisfies readonly CalendarColor[]

export function assertSafeCalendarColors(state: Pick<PlannerState, 'calendars'>): void {
  if (!state.calendars.every((calendar) => isCalendarColor(calendar.color))) {
    throw new Error('Обнаружен небезопасный цвет календаря')
  }
}

export function blankState(now = new Date()): PlannerState {
  return {
    schemaVersion: 1,
    calendars: [{
      id: crypto.randomUUID(),
      name: 'Личное',
      color: PALETTE[0],
      visible: true,
      createdAt: now.toISOString(),
    }],
    events: [],
  }
}
