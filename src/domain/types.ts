export type LocalDate = `${number}-${number}-${number}`
export type LocalTime = `${number}:${number}`
export type CalendarColor = `#${string}`

const CALENDAR_COLOR_PATTERN = /^#[0-9a-f]{6}$/
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function isCalendarColor(value: unknown): value is CalendarColor {
  return typeof value === 'string' && CALENDAR_COLOR_PATTERN.test(value)
}

export function parseCalendarColor(value: unknown): CalendarColor {
  if (!isCalendarColor(value)) throw new Error('Цвет календаря должен быть в формате #rrggbb')
  return value
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && LOCAL_TIME_PATTERN.test(value)
}

export function parseLocalTime(value: unknown): LocalTime {
  if (!isLocalTime(value)) throw new Error('Время должно быть в формате HH:mm')
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
  allDay: boolean
  startTime?: LocalTime
  endTime?: LocalTime
  recurrence?: Recurrence
  cityId?: string
  createdAt: string
  updatedAt: string
}

export function validateEventTiming(event: Pick<PlannerEvent, 'allDay' | 'startDate' | 'endDateExclusive' | 'startTime' | 'endTime'>): void {
  if (event.allDay) {
    if (event.startTime !== undefined || event.endTime !== undefined) {
      throw new Error('У события на весь день не должно быть времени')
    }
    return
  }
  if (!isLocalTime(event.startTime)) throw new Error('Укажите корректное время начала')
  if (event.endTime !== undefined && !isLocalTime(event.endTime)) throw new Error('Укажите корректное время окончания')
  if (event.endTime === undefined) return

  const finalDay = new Date(`${event.endDateExclusive}T00:00:00.000Z`)
  finalDay.setUTCDate(finalDay.getUTCDate() - 1)
  const finalDate = `${finalDay.getUTCFullYear()}-${String(finalDay.getUTCMonth() + 1).padStart(2, '0')}-${String(finalDay.getUTCDate()).padStart(2, '0')}`
  if (`${finalDate}T${event.endTime}` <= `${event.startDate}T${event.startTime}`) {
    throw new Error('Время окончания должно быть позже времени начала')
  }
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
