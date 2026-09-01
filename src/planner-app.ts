import { createBackup, previewBackup, restoreAsCopy, type RestorePreview } from './data/backup'
import { getCity, plannerCities } from './data/cities'
import { exportIcs, importIcs } from './data/ical'
import { addDays, isWeekend, localDate, parseLocalDate, todayLocal } from './domain/dates'
import { cityEventGroups } from './domain/city-map'
import { expandEvent } from './domain/recurrence'
import { activeMonthIndexes, isDateInScope, type PeriodScope } from './domain/scope'
import { blankState, deleteCalendar, parseCalendarColor, parseLocalTime, PALETTE, updateCalendarDetails, validateEventTiming, type LocalDate, type PlannerCalendar, type PlannerEvent, type PlannerState } from './domain/types'
import { installEmbedContract, requestCleanView, requestFullView } from './embed'
import { PlannerDatabase } from './storage/idb'
import { PlannerStateSync } from './storage/state-sync'
import { providerCapabilities } from './sync/provider'
import L from 'leaflet'
import { feature } from 'topojson-client'
import countriesTopology from 'world-atlas/countries-110m.json'
import type { GeoJsonObject } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

type ViewMode = 'year' | 'flow' | 'map'
type DisplayMode = 'banners' | 'heatmap'
type ThemeMode = 'system' | 'light' | 'dark'

const monthNames = new Intl.DateTimeFormat('ru-RU', { month: 'long' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const THEME_KEY = 'digitable-planner-theme'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = el('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'))
    reader.readAsText(file)
  })
}

export class PlannerApp {
  private database?: PlannerDatabase
  private stateSync?: PlannerStateSync
  private state: PlannerState = blankState()
  private year = new Date().getFullYear()
  private selectedDate?: LocalDate
  private viewMode: ViewMode = 'year'
  private displayMode: DisplayMode = 'banners'
  private periodScope: PeriodScope = 'year'
  private customMonths = [...Array(12).keys()]
  private themeMode: ThemeMode = 'system'
  private persistenceError = ''
  private restorePreview?: RestorePreview
  private installPrompt?: Event & { prompt(): Promise<void> }
  private selectedCityId?: string
  private settingsOpen = false
  private settingsFeedback = ''
  private cleanView = false
  private map?: L.Map

  constructor(private readonly root: HTMLElement, private readonly embedded = false) {}

  async start(): Promise<void> {
    if (!this.embedded) {
      try {
        const storedTheme = localStorage.getItem(THEME_KEY)
        if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') this.themeMode = storedTheme
      } catch { /* private browsing can deny storage */ }
      this.applyStandaloneTheme()
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.themeMode === 'system') this.applyStandaloneTheme()
      })
    }
    try {
      this.database = await PlannerDatabase.open()
      this.state = await this.database.load()
      if ('BroadcastChannel' in window) {
        this.stateSync = new PlannerStateSync(() => void this.reloadFromStorage())
        window.addEventListener('pagehide', (event) => { if (!event.persisted) this.stateSync?.close() })
      }
    } catch (error) {
      this.persistenceError = `Хранилище недоступно: ${error instanceof Error ? error.message : String(error)}. Изменения живут только до закрытия вкладки.`
    }
    installEmbedContract((theme) => {
      document.documentElement.dataset.theme = theme
      if (this.viewMode === 'map') this.render()
    })
    window.addEventListener('pagehide', () => requestCleanView(false))
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.installPrompt = event as typeof this.installPrompt
      this.render()
    })
    this.render()
  }

  private async commit(next: PlannerState): Promise<boolean> {
    const previous = this.state
    this.state = next
    try {
      await this.database?.save(next)
      this.persistenceError = ''
      this.stateSync?.notifyChanged()
      this.render()
      return true
    } catch (error) {
      this.state = previous
      this.persistenceError = `Не удалось сохранить: ${error instanceof Error ? error.message : String(error)}`
      this.render()
      return false
    }
  }

  private async reloadFromStorage(): Promise<void> {
    if (!this.database) return
    try {
      this.state = await this.database.load()
      this.persistenceError = ''
    } catch (error) {
      this.persistenceError = `Не удалось обновить данные из другой вкладки: ${error instanceof Error ? error.message : String(error)}`
    }
    this.render()
  }

  private render(): void {
    this.map?.remove()
    this.map = undefined
    document.documentElement.dataset.plannerView = this.viewMode
    document.documentElement.dataset.cleanView = this.cleanView ? 'true' : 'false'
    this.root.replaceChildren()
    const shell = el('div', 'app-shell')
    if (!this.embedded && !this.cleanView) shell.append(this.renderHeader())
    if (this.persistenceError) {
      const warning = el('div', 'notice notice--danger', this.persistenceError)
      warning.setAttribute('role', 'alert')
      shell.append(warning)
    }
    shell.append(this.renderPlanner())
    const settings = this.renderSettingsDialog()
    this.root.append(shell, this.renderEventDialog(), this.renderCalendarDialog(), this.renderPeriodDialog(), this.renderConfirmationDialog(), settings)
    if (this.settingsOpen) requestAnimationFrame(() => { if (settings.isConnected && !settings.open) settings.showModal() })
  }

  private renderHeader(): HTMLElement {
    const header = el('header', 'topbar')
    const brand = el('button', 'brand')
    brand.type = 'button'
    brand.setAttribute('aria-label', 'Открыть планировщик')
    brand.innerHTML = '<img class="brand__logo" src="/digitable-logo-96.png" alt=""><span>Digitable <strong>Planner</strong></span>'
    brand.addEventListener('click', () => document.querySelector<HTMLElement>('#planner')?.focus())
    const nav = el('nav', 'topnav')
    nav.setAttribute('aria-label', 'Основная навигация')
    const planner = this.headerButton('Год', true, () => document.querySelector<HTMLElement>('#planner')?.focus())
    const settings = this.headerButton('Данные и подключения', false, () => this.openSettingsDialog())
    nav.append(planner, settings)
    const privacy = el('span', 'privacy-pill', 'Локально · без аккаунта')
    header.append(brand, nav, privacy)
    return header
  }

  private headerButton(label: string, active: boolean, action: () => void): HTMLButtonElement {
    const button = el('button', `nav-button${active ? ' is-active' : ''}`, label)
    button.type = 'button'
    if (active) button.setAttribute('aria-current', 'page')
    button.addEventListener('click', action)
    return button
  }

  private renderPlanner(): HTMLElement {
    const main = el('main', `workspace workspace--${this.viewMode}${this.cleanView ? ' workspace--clean' : ''}`)
    main.id = 'planner'
    main.tabIndex = -1
    const showMenus = this.textButton(`${this.year} · Показать меню`, () => this.setCleanView(false), 'clean-view-exit')
    showMenus.setAttribute('aria-label', 'Показать меню планировщика')
    const toolbar = el('section', 'toolbar')
    toolbar.setAttribute('aria-label', 'Управление годом')
    const yearControl = el('div', 'year-control')
    yearControl.append(
      this.iconButton('←', 'Предыдущий год', () => { this.year -= 1; this.render() }),
      el('h1', 'year-title', String(this.year)),
      this.iconButton('→', 'Следующий год', () => { this.year += 1; this.render() }),
      this.textButton('Сегодня', () => {
        const today = todayLocal()
        this.year = new Date().getFullYear()
        if (!this.dateIsActive(today)) this.periodScope = 'year'
        this.selectedDate = today
        this.render()
      }),
    )
    const modes = el('div', 'mode-controls')
    const viewSelect = this.selectControl('Раскладка', [['year', 'Год'], ['flow', 'Лента'], ['map', 'Карта']], this.viewMode, (value) => { this.viewMode = value as ViewMode; this.render() })
    const displaySelect = this.selectControl('События', [['banners', 'Плашки'], ['heatmap', 'Нагрузка']], this.displayMode, (value) => { this.displayMode = value as DisplayMode; this.render() })
    const periodSelect = this.selectControl('Период', [
      ['year', 'Весь год'], ['future', 'Только будущее'],
      ['q1', 'I квартал'], ['q2', 'II квартал'], ['q3', 'III квартал'], ['q4', 'IV квартал'],
      ['custom', 'Выбрать месяцы…'],
    ], this.periodScope, (value) => this.changePeriod(value as PeriodScope))
    modes.append(viewSelect, periodSelect, displaySelect)
    if (this.embedded) modes.append(this.textButton('Данные', () => this.openSettingsDialog()))
    else {
      modes.append(this.selectControl('Тема', [['system', 'Тема: системная'], ['light', 'Тема: светлая'], ['dark', 'Тема: тёмная']], this.themeMode, (value) => this.changeTheme(value as ThemeMode)))
      modes.append(this.textButton('На весь экран', () => this.enterFullScreen()))
    }
    const hideMenus = this.textButton('Скрыть меню', () => this.setCleanView(true))
    hideMenus.classList.add('clean-view-enter')
    modes.append(hideMenus)
    modes.append(this.textButton('+ Событие', () => this.openEventDialog(this.selectedDate ?? todayLocal())))
    toolbar.append(yearControl, modes)

    const layout = el('div', `planner-layout${this.viewMode === 'map' ? ' planner-layout--map' : ''}`)
    layout.append(this.renderSidebar())
    const content = this.viewMode === 'map' ? this.renderMap() : el('section', `months months--${this.viewMode}`)
    if (this.viewMode !== 'map') {
      content.setAttribute('aria-label', `Календарь на ${this.year} год`)
      const months = this.activeMonths()
      content.classList.toggle('months--filtered', months.length !== 12)
      content.style.setProperty('--month-columns', String(Math.max(1, Math.min(4, months.length))))
      if (!months.length) content.append(el('p', 'period-empty', 'В выбранном периоде нет будущих дат. Переключите год или выберите другой период.'))
      for (const month of months) content.append(this.renderMonth(month))
    }
    layout.append(content, this.renderDayPanel())
    main.append(showMenus, toolbar, layout)
    return main
  }

  private setCleanView(enabled: boolean): void {
    this.cleanView = enabled
    requestCleanView(enabled)
    this.render()
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(enabled ? '.clean-view-exit' : '.clean-view-enter')?.focus())
  }

  private renderSidebar(): HTMLElement {
    const aside = el('aside', 'calendars-panel')
    const title = el('div', 'panel-heading')
    title.append(el('h2', '', 'Календари'), this.iconButton('+', 'Добавить календарь', () => this.openCalendarDialog()))
    aside.append(title)
    for (const calendar of this.state.calendars) {
      const row = el('div', 'calendar-row')
      const toggle = el('label', 'calendar-toggle')
      const checkbox = el('input')
      checkbox.type = 'checkbox'
      checkbox.checked = calendar.visible
      checkbox.setAttribute('aria-label', `Показывать календарь «${calendar.name}»`)
      checkbox.addEventListener('change', () => void this.commit({ ...this.state, calendars: this.state.calendars.map((item) => item.id === calendar.id ? { ...item, visible: checkbox.checked } : item) }))
      const dot = el('span', 'calendar-dot')
      dot.style.backgroundColor = calendar.color
      const name = el('span', 'calendar-name', calendar.name)
      name.title = calendar.name
      const edit = this.iconButton('⋯', `Изменить календарь «${calendar.name}»`, () => this.openCalendarDialog(calendar))
      edit.classList.add('calendar-edit')
      toggle.append(checkbox, dot, name)
      row.append(toggle, edit)
      aside.append(row)
    }
    const occurrences = this.visibleOccurrencesInScope()
    const occupiedDates = new Set<LocalDate>()
    const yearStart = localDate(this.year, 1, 1)
    const yearEnd = localDate(this.year + 1, 1, 1)
    for (const occurrence of occurrences) {
      let date = occurrence.startDate < yearStart ? yearStart : occurrence.startDate
      const end = occurrence.endDateExclusive < yearEnd ? occurrence.endDateExclusive : yearEnd
      while (date < end) {
        if (this.dateIsActive(date)) occupiedDates.add(date)
        date = addDays(date, 1)
      }
    }
    const stats = el('section', 'calendar-stats')
    stats.setAttribute('aria-label', 'Статистика выбранного периода')
    stats.append(el('h3', '', 'В выбранном периоде'))
    const statGrid = el('div', 'calendar-stats__grid')
    for (const [value, label] of [
      [occurrences.length, 'событий'],
      [occupiedDates.size, 'дней'],
      [new Set(occurrences.flatMap(({ cityId }) => cityId ? [cityId] : [])).size, 'городов'],
      [this.state.calendars.filter(({ visible }) => visible).length, 'календарей'],
    ] as const) {
      const item = el('div', 'calendar-stat')
      item.append(el('strong', '', String(value)), el('span', '', label))
      statGrid.append(item)
    }
    stats.append(statGrid)
    const note = el('p', 'microcopy', 'Данные остаются в этом браузере. Сделайте резервную копию в разделе «Данные».')
    aside.append(stats, note)
    return aside
  }

  private renderMap(): HTMLElement {
    const pane = el('section', 'city-map-pane')
    pane.setAttribute('aria-label', `Карта событий на ${this.year} год`)
    const groups = cityEventGroups(this.state, this.year)
      .map((group) => ({ ...group, occurrences: group.occurrences.filter((event) => this.occurrenceTouchesScope(event)) }))
      .filter(({ occurrences }) => occurrences.length)
    if (this.selectedCityId && !groups.some(({ city }) => city.id === this.selectedCityId)) this.selectedCityId = undefined
    const active = groups.find(({ city }) => city.id === this.selectedCityId) ?? groups[0]

    const heading = el('div', 'city-map-heading')
    const title = el('div')
    title.append(el('p', 'eyebrow', 'Где и когда'), el('h2', '', 'Карта года'))
    heading.append(title, el('p', 'microcopy', 'Интерактивная офлайн-карта: границы, масштаб и события загружены вместе с приложением. Геолокация и сетевые тайлы не используются.'))

    const frame = el('div', 'city-map-frame')
    frame.setAttribute('role', 'application')
    frame.setAttribute('aria-label', 'Интерактивная карта городов с событиями')
    requestAnimationFrame(() => this.initializeMap(frame, groups, active?.city.id))

    const timeline = el('div', 'city-timeline')
    if (!active) {
      timeline.append(el('h3', '', 'На карте пока пусто'), el('p', 'empty-state', 'Выберите город в событии — он появится здесь вместе с датой и календарём.'))
    } else {
      const activeHeading = el('div', 'city-timeline__heading')
      activeHeading.append(el('h3', '', `${active.city.name}, ${active.city.country}`), el('span', 'status-badge status-badge--ready', `${active.occurrences.length} событий`))
      timeline.append(activeHeading, el('p', 'microcopy', `Часовой пояс: ${active.city.timeZone}. Линия соединяет города по времени первого события, а не прокладывает маршрут.`))
      for (const event of active.occurrences) {
        const card = el('button', 'city-event-card')
        card.type = 'button'
        const calendar = this.state.calendars.find(({ id }) => id === event.calendarId)
        card.style.setProperty('--event-color', calendar?.color ?? PALETTE[0])
        card.append(el('time', '', `${event.startDate} · ${this.eventTimeLabel(event)}`), el('strong', '', event.title), el('span', '', calendar?.name ?? 'Календарь'))
        card.addEventListener('click', () => {
          this.selectedDate = event.startDate
          this.openEventDialog(event.startDate, event.id.split('::')[0])
        })
        timeline.append(card)
      }
    }
    pane.append(heading, frame, timeline)
    return pane
  }

  private initializeMap(frame: HTMLElement, groups: ReturnType<typeof cityEventGroups>, activeCityId?: string): void {
    if (!frame.isConnected) return
    const map = L.map(frame, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 1,
      maxZoom: 7,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1,
    }).setView([38, 35], 2)
    this.map = map
    const theme = getComputedStyle(document.documentElement)
    const lineColor = theme.getPropertyValue('--line-strong').trim()
    const landColor = theme.getPropertyValue('--paper-2').trim()
    const accentColor = theme.getPropertyValue('--accent').trim()
    const topology = countriesTopology as unknown as Topology<{ countries: GeometryCollection }>
    L.geoJSON(feature(topology, topology.objects.countries) as GeoJsonObject, {
      style: { className: 'leaflet-country', color: lineColor, fillColor: landColor, weight: 1, fillOpacity: 1 },
    }).addTo(map)

    if (groups.length > 1) {
      L.polyline(groups.map(({ city }) => [city.latitude, city.longitude]), {
        className: 'leaflet-chronology', color: accentColor, weight: 2.5, dashArray: '7 7', opacity: 0.7, interactive: false,
      }).addTo(map)
    }
    const bounds = L.latLngBounds([])
    for (const group of groups) {
      const active = activeCityId === group.city.id
      const icon = L.divIcon({
        className: 'leaflet-city-icon-wrap',
        html: `<span class="leaflet-city-icon${active ? ' is-active' : ''}">${group.occurrences.length}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const marker = L.marker([group.city.latitude, group.city.longitude], {
        icon,
        keyboard: true,
        title: `${group.city.name}: ${group.occurrences.length} событий`,
        alt: group.city.name,
      }).addTo(map)
      marker.bindTooltip(group.city.name, { direction: 'top', offset: [0, -13], opacity: 1 })
      marker.on('click', () => {
        this.selectedCityId = group.city.id
        this.selectedDate = group.occurrences[0].startDate
        this.render()
      })
      bounds.extend([group.city.latitude, group.city.longitude])
    }
    if (groups.length === 1) map.setView(bounds.getCenter(), 4)
    else if (groups.length > 1) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 5 })
    map.attributionControl.setPrefix(false)
    map.attributionControl.addAttribution('Границы: Natural Earth · world-atlas')
  }

  private renderMonth(month: number): HTMLElement {
    const section = el('article', 'month-card')
    const date = new Date(Date.UTC(this.year, month, 1))
    const heading = el('h2', 'month-title', monthNames.format(date))
    const table = el('div', 'month-grid')
    table.setAttribute('role', 'grid')
    table.setAttribute('aria-label', `${monthNames.format(date)} ${this.year}`)
    weekDays.forEach((day) => {
      const cell = el('span', 'weekday', day)
      cell.setAttribute('role', 'columnheader')
      table.append(cell)
    })
    const firstOffset = (date.getUTCDay() + 6) % 7
    for (let index = 0; index < firstOffset; index += 1) table.append(el('span', 'day day--empty'))
    const days = new Date(Date.UTC(this.year, month + 1, 0)).getUTCDate()
    for (let day = 1; day <= days; day += 1) table.append(this.renderDay(localDate(this.year, month + 1, day), day))
    section.append(heading, table)
    return section
  }

  private renderDay(date: LocalDate, dayNumber: number): HTMLElement {
    const cell = el('div', 'day')
    cell.setAttribute('role', 'gridcell')
    const active = this.dateIsActive(date)
    if (!active) cell.classList.add('day--outside-scope')
    if (date === todayLocal()) cell.classList.add('is-today')
    if (date === this.selectedDate) cell.classList.add('is-selected')
    if (isWeekend(date)) cell.classList.add('is-weekend')
    const button = el('button', 'day-number', String(dayNumber))
    button.type = 'button'
    button.dataset.date = date
    button.disabled = !active
    button.setAttribute('aria-label', fullDate.format(parseLocalDate(date)))
    button.addEventListener('click', () => { this.selectedDate = this.selectedDate === date ? undefined : date; this.render() })
    button.addEventListener('dblclick', () => this.openEventDialog(date))
    button.addEventListener('keydown', (event) => this.onDateKey(event, date))
    cell.append(button)
    const events = this.eventsForDate(date)
    if (this.displayMode === 'heatmap') {
      if (events.length) {
        const heat = el('span', 'heat')
        heat.style.opacity = String(Math.min(1, 0.25 + events.length * 0.18))
        heat.title = `${events.length} событий`
        cell.append(heat)
      }
    } else {
      for (const event of events.slice(0, 3)) {
        const calendar = this.state.calendars.find(({ id }) => id === event.calendarId)
        const eventButton = el('button', 'event-chip', `${event.allDay ? '' : `${event.startTime} `}${event.startDate < date ? '← ' : ''}${event.title}${event.endDateExclusive > addDays(date, 1) ? ' →' : ''}`)
        eventButton.type = 'button'
        eventButton.style.setProperty('--event-color', calendar?.color ?? PALETTE[0])
        eventButton.title = event.title
        eventButton.addEventListener('click', () => this.openEventDialog(date, event.id.split('::')[0]))
        cell.append(eventButton)
      }
      if (events.length > 3) cell.append(el('span', 'more-events', `+${events.length - 3}`))
    }
    return cell
  }

  private eventsForDate(date: LocalDate): PlannerEvent[] {
    if (!this.dateIsActive(date)) return []
    const visible = new Set(this.state.calendars.filter(({ visible }) => visible).map(({ id }) => id))
    return this.state.events
      .filter(({ calendarId }) => visible.has(calendarId))
      .flatMap((event) => expandEvent(event, date, addDays(date, 1)))
      .sort((a, b) => (a.allDay ? '' : a.startTime ?? '').localeCompare(b.allDay ? '' : b.startTime ?? '') || a.title.localeCompare(b.title, 'ru'))
  }

  private renderDayPanel(): HTMLElement {
    const aside = el('aside', 'day-panel')
    const heading = el('div', 'panel-heading')
    const headingText = el('div')
    const controls = el('div', 'panel-heading__actions')
    let events: PlannerEvent[]
    if (this.selectedDate) {
      headingText.append(el('p', 'eyebrow', 'Выбранный день'), el('h2', '', fullDate.format(parseLocalDate(this.selectedDate))))
      controls.append(this.iconButton('×', 'Снять выбор дня', () => { this.selectedDate = undefined; this.render() }))
      controls.append(this.iconButton('+', 'Добавить событие в этот день', () => this.openEventDialog(this.selectedDate!)))
      events = this.eventsForDate(this.selectedDate)
    } else {
      headingText.append(el('p', 'eyebrow', this.scopeLabel()), el('h2', '', 'Все мероприятия'))
      controls.append(this.iconButton('+', 'Добавить событие', () => this.openEventDialog(todayLocal())))
      events = this.visibleOccurrencesInScope()
    }
    heading.append(headingText, controls)
    aside.append(heading)
    if (!events.length) aside.append(el('p', 'empty-state', this.selectedDate ? 'Пока свободно. Двойной щелчок по дню тоже создаёт событие.' : 'В выбранном периоде пока нет мероприятий.'))
    for (const event of events) {
      const card = el('button', 'agenda-card')
      card.type = 'button'
      const calendar = this.state.calendars.find(({ id }) => id === event.calendarId)
      const city = getCity(event.cityId)
      card.style.setProperty('--event-color', calendar?.color ?? PALETTE[0])
      if (!this.selectedDate) card.append(el('time', 'agenda-card__date', fullDate.format(parseLocalDate(event.startDate))))
      card.append(el('strong', '', event.title), el('span', '', `${this.eventTimeLabel(event)} · ${calendar?.name ?? 'Календарь'}`))
      if (city) card.append(el('span', '', `⌖ ${city.name}`))
      if (event.startDate !== addDays(event.endDateExclusive, -1)) card.append(el('span', '', `${event.startDate} — ${addDays(event.endDateExclusive, -1)}`))
      card.addEventListener('click', () => this.openEventDialog(event.startDate, event.id.split('::')[0]))
      aside.append(card)
    }
    return aside
  }

  private activeMonths(): number[] {
    return activeMonthIndexes(this.year, this.periodScope, this.customMonths)
  }

  private dateIsActive(date: LocalDate): boolean {
    return isDateInScope(date, this.year, this.periodScope, this.customMonths)
  }

  private visibleOccurrencesInScope(): PlannerEvent[] {
    const visible = new Set(this.state.calendars.filter(({ visible }) => visible).map(({ id }) => id))
    return this.state.events
      .filter(({ calendarId }) => visible.has(calendarId))
      .flatMap((event) => expandEvent(event, localDate(this.year, 1, 1), localDate(this.year + 1, 1, 1)))
      .filter((event) => this.occurrenceTouchesScope(event))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)
        || (a.allDay ? '' : a.startTime ?? '').localeCompare(b.allDay ? '' : b.startTime ?? '')
        || a.title.localeCompare(b.title, 'ru'))
  }

  private occurrenceTouchesScope(event: PlannerEvent): boolean {
    if (this.periodScope === 'future' && event.endDateExclusive <= todayLocal()) return false
    return this.activeMonths().some((month) => {
      const monthStart = localDate(this.year, month + 1, 1)
      const monthEnd = month === 11 ? localDate(this.year + 1, 1, 1) : localDate(this.year, month + 2, 1)
      return event.startDate < monthEnd && event.endDateExclusive > monthStart
    })
  }

  private eventTimeLabel(event: PlannerEvent): string {
    if (event.allDay || !event.startTime) return 'Весь день'
    return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime
  }

  private scopeLabel(): string {
    if (this.periodScope === 'year') return `${this.year} год`
    if (this.periodScope === 'future') return 'Только будущее'
    if (this.periodScope === 'custom') return 'Выбранные месяцы'
    return `${this.periodScope.slice(1)} квартал`
  }

  private changePeriod(scope: PeriodScope): void {
    this.periodScope = scope
    if (this.selectedDate && !this.dateIsActive(this.selectedDate)) this.selectedDate = undefined
    this.render()
    if (scope === 'custom') requestAnimationFrame(() => this.openPeriodDialog())
  }

  private renderPeriodDialog(): HTMLDialogElement {
    const dialog = el('dialog', 'dialog period-dialog')
    dialog.id = 'period-dialog'
    dialog.setAttribute('aria-labelledby', 'period-dialog-title')
    return dialog
  }

  private openPeriodDialog(): void {
    const dialog = document.querySelector<HTMLDialogElement>('#period-dialog')
    if (!dialog) return
    const form = el('form', 'dialog-form')
    const heading = el('div', 'dialog-heading')
    const title = el('h2', '', 'Какие месяцы показать')
    title.id = 'period-dialog-title'
    heading.append(title, this.iconButton('×', 'Закрыть', () => dialog.close()))
    const months = el('fieldset', 'month-choices')
    months.append(el('legend', '', 'Выберите один или несколько месяцев'))
    for (let month = 0; month < 12; month += 1) {
      const label = el('label', 'month-choice')
      const checkbox = el('input')
      checkbox.type = 'checkbox'
      checkbox.name = 'month'
      checkbox.value = String(month)
      checkbox.checked = this.customMonths.includes(month)
      label.append(checkbox, el('span', '', monthNames.format(new Date(Date.UTC(this.year, month, 1)))))
      months.append(label)
    }
    const validation = el('p', 'field-error')
    validation.setAttribute('role', 'alert')
    const actions = el('div', 'dialog-actions')
    actions.append(
      this.textButton('Все месяцы', () => { for (const checkbox of form.querySelectorAll<HTMLInputElement>('input[name="month"]')) checkbox.checked = true }, 'secondary-button'),
      this.textButton('Отмена', () => dialog.close(), 'secondary-button'),
      Object.assign(el('button', 'primary-button', 'Показать'), { type: 'submit' }),
    )
    form.append(heading, months, validation, actions)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const selected = [...form.querySelectorAll<HTMLInputElement>('input[name="month"]:checked')].map(({ value }) => Number(value))
      if (!selected.length) { validation.textContent = 'Выберите хотя бы один месяц'; return }
      this.customMonths = selected
      this.selectedDate = this.selectedDate && this.dateIsActive(this.selectedDate) ? this.selectedDate : undefined
      dialog.close()
      this.render()
    })
    dialog.replaceChildren(form)
    dialog.showModal()
  }

  private renderConfirmationDialog(): HTMLDialogElement {
    const dialog = el('dialog', 'dialog confirmation-dialog')
    dialog.id = 'confirmation-dialog'
    dialog.setAttribute('aria-labelledby', 'confirmation-dialog-title')
    return dialog
  }

  private confirmAction(titleText: string, message: string, confirmLabel = 'Удалить'): Promise<boolean> {
    const dialog = document.querySelector<HTMLDialogElement>('#confirmation-dialog')
    if (!dialog) return Promise.resolve(false)
    const form = el('form', 'dialog-form')
    form.method = 'dialog'
    const heading = el('div', 'dialog-heading')
    const title = el('h2', '', titleText)
    title.id = 'confirmation-dialog-title'
    heading.append(title, this.iconButton('×', 'Закрыть', () => dialog.close('cancel')))
    const actions = el('div', 'dialog-actions')
    const cancel = Object.assign(el('button', 'secondary-button', 'Отмена'), { type: 'submit', value: 'cancel' })
    const confirm = Object.assign(el('button', 'danger-button danger-button--filled', confirmLabel), { type: 'submit', value: 'confirm' })
    actions.append(cancel, confirm)
    form.append(heading, el('p', 'confirmation-copy', message), actions)
    dialog.replaceChildren(form)
    return new Promise((resolve) => {
      dialog.returnValue = ''
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true })
      dialog.showModal()
      cancel.focus()
    })
  }

  private changeTheme(theme: ThemeMode): void {
    this.themeMode = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* non-essential preference */ }
    this.applyStandaloneTheme()
    this.render()
  }

  private applyStandaloneTheme(): void {
    const resolved = this.themeMode === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : this.themeMode
    document.documentElement.dataset.theme = resolved
  }

  private renderSettingsDialog(): HTMLDialogElement {
    const dialog = el('dialog', 'dialog settings-dialog')
    dialog.id = 'settings-dialog'
    dialog.setAttribute('aria-labelledby', 'settings-dialog-title')
    dialog.addEventListener('close', () => { this.settingsOpen = false })
    const hero = el('section', 'settings-hero')
    const heading = el('div', 'dialog-heading')
    const title = el('div')
    const titleText = el('h2', '', 'Данные и подключения')
    titleText.id = 'settings-dialog-title'
    title.append(el('p', 'eyebrow', 'Ваши данные — ваши'), titleText)
    heading.append(title, this.iconButton('×', 'Закрыть', () => this.closeSettingsDialog()))
    hero.append(heading, el('p', 'lede', 'Локальные действия и перенос данных — без аккаунта, аналитики и скрытых подключений.'))
    if (this.settingsFeedback) {
      const feedback = el('div', 'notice settings-feedback', this.settingsFeedback)
      feedback.setAttribute('role', 'status')
      hero.append(feedback)
    }
    const grid = el('div', 'settings-grid')
    grid.append(this.renderBackupCard(), this.renderIcsCard(), this.renderProviderCard(), this.renderAppCard())
    hero.append(grid)
    dialog.append(hero)
    return dialog
  }

  private openSettingsDialog(): void {
    this.settingsOpen = true
    const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog')
    if (dialog && !dialog.open) dialog.showModal()
  }

  private closeSettingsDialog(): void {
    this.settingsOpen = false
    document.querySelector<HTMLDialogElement>('#settings-dialog')?.close()
  }

  private renderBackupCard(): HTMLElement {
    const card = this.settingsCard('Резервная копия .dplan', 'Полный JSON-снимок с версией и контрольной суммой.')
    card.append(this.textButton('Скачать .dplan', () => download(`digitable-planner-${todayLocal()}.dplan`, createBackup(this.state), 'application/json')))
    const label = el('label', 'file-button', 'Проверить и восстановить…')
    const input = el('input')
    input.type = 'file'
    input.accept = '.dplan,application/json'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (!file) return
      try { this.restorePreview = previewBackup(await readFile(file)); this.settingsFeedback = ''; this.render() }
      catch (error) { this.settingsFeedback = error instanceof Error ? error.message : String(error); this.render() }
    })
    label.append(input)
    card.append(label)
    if (this.restorePreview) {
      const preview = el('div', 'restore-preview')
      preview.append(el('strong', '', 'Проверка пройдена'), el('p', '', `${this.restorePreview.calendars} календарей, ${this.restorePreview.events} событий. Исходные данные останутся без изменений.`))
      preview.append(this.textButton('Восстановить как копию', () => this.restoreCopy()))
      card.append(preview)
    }
    return card
  }

  private async restoreCopy(): Promise<void> {
    if (!this.restorePreview) return
    const focusDate = this.restorePreview.earliest as LocalDate | undefined
    const restored = restoreAsCopy(this.state, this.restorePreview)
    if (!await this.commit(restored)) return
    this.restorePreview = undefined
    this.settingsOpen = false
    if (focusDate) {
      this.selectedDate = focusDate
      this.year = parseLocalDate(focusDate).getUTCFullYear()
      this.periodScope = 'year'
    }
    this.render()
  }

  private renderIcsCard(): HTMLElement {
    const card = this.settingsCard('iCalendar (.ics)', 'Переносите поддерживаемые поля без подключения к сервису.')
    card.append(this.textButton('Экспортировать видимые', () => {
      const visible = new Set(this.state.calendars.filter(({ visible }) => visible).map(({ id }) => id))
      download(`digitable-planner-${todayLocal()}.ics`, exportIcs(this.state.events.filter(({ calendarId }) => visible.has(calendarId))), 'text/calendar')
    }))
    const label = el('label', 'file-button', 'Импортировать .ics…')
    const input = el('input')
    input.type = 'file'
    input.accept = '.ics,text/calendar'
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      const calendar = this.state.calendars[0]
      if (!file || !calendar) return
      try {
        const occupied = new Set(this.state.events.map(({ id }) => id))
        const events = importIcs(await readFile(file), calendar.id).map((event) => {
          if (!occupied.has(event.id)) { occupied.add(event.id); return event }
          const id = `${event.id}-${crypto.randomUUID()}`
          occupied.add(id)
          return { ...event, id }
        })
        if (await this.commit({ ...this.state, events: [...this.state.events, ...events] })) {
          this.settingsFeedback = `Импортировано событий: ${events.length}`
          this.render()
        }
      } catch (error) { this.settingsFeedback = error instanceof Error ? error.message : String(error); this.render() }
    })
    label.append(input)
    card.append(label)
    return card
  }

  private renderProviderCard(): HTMLElement {
    const card = this.settingsCard('Синхронизация', 'Архитектурный порт готов, сетевые адаптеры не включены.')
    for (const provider of providerCapabilities) {
      const row = el('div', 'provider-row')
      const head = el('div', 'provider-row__head')
      head.append(el('strong', '', provider.title), el('span', 'status-badge', provider.status))
      row.append(head, el('p', '', provider.detail))
      card.append(row)
    }
    card.append(el('p', 'microcopy', 'Мы никогда не попросим основной пароль Apple ID. Реальная синхронизация появится только после доказанной браузерной совместимости.'))
    return card
  }

  private renderAppCard(): HTMLElement {
    const card = this.settingsCard('Приложение', 'Установите планировщик на домашний экран или откройте его без рамок браузера.')
    card.append(this.textButton(this.installPrompt ? 'Установить PWA' : 'Как установить', async () => {
      if (this.installPrompt) {
        await this.installPrompt.prompt()
        this.installPrompt = undefined
        this.render()
      } else {
        this.settingsFeedback = 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».'
        this.render()
      }
    }))
    card.append(this.textButton('На весь экран', () => this.enterFullScreen()))
    card.append(this.textButton('Сбросить календарь', () => this.resetCalendar(), 'danger-button reset-button'))
    card.append(el('p', 'microcopy', 'Офлайн-оболочка сохраняется после первого успешного открытия. Календарные данные не попадают в кэш приложения.'))
    return card
  }

  private async resetCalendar(): Promise<void> {
    this.closeSettingsDialog()
    if (!await this.confirmAction('Сбросить календарь?', 'Будут удалены все локальные календари и события. Вернуть их можно только из заранее скачанной резервной копии.', 'Сбросить всё')) {
      this.settingsOpen = true
      this.render()
      return
    }
    if (!await this.commit(blankState())) return
    this.settingsOpen = false
    this.restorePreview = undefined
    this.year = new Date().getFullYear()
    this.selectedDate = undefined
    this.selectedCityId = undefined
    this.viewMode = 'year'
    this.render()
  }

  private settingsCard(title: string, description: string): HTMLElement {
    const card = el('section', 'settings-card')
    card.append(el('h2', '', title), el('p', '', description))
    return card
  }

  private renderEventDialog(): HTMLDialogElement {
    const dialog = el('dialog', 'dialog')
    dialog.id = 'event-dialog'
    dialog.setAttribute('aria-labelledby', 'event-dialog-title')
    return dialog
  }

  private openEventDialog(date: LocalDate, eventId?: string): void {
    const dialog = document.querySelector<HTMLDialogElement>('#event-dialog')
    if (!dialog) return
    const existing = eventId ? this.state.events.find(({ id }) => id === eventId) : undefined
    const form = el('form', 'dialog-form')
    form.method = 'dialog'
    const heading = el('div', 'dialog-heading')
    const title = el('h2', '', existing ? 'Изменить событие' : 'Новое событие')
    title.id = 'event-dialog-title'
    heading.append(title, this.iconButton('×', 'Закрыть', () => dialog.close()))
    const titleInput = this.field('Название', 'text', existing?.title ?? '')
    titleInput.input.required = true
    titleInput.input.maxLength = 300
    const startInput = this.field('Начало', 'date', existing?.startDate ?? date)
    const endInput = this.field('Последний день', 'date', existing ? addDays(existing.endDateExclusive, -1) : date)
    const timeToggle = el('label', 'time-toggle')
    const timed = el('input')
    timed.type = 'checkbox'
    timed.checked = existing ? !existing.allDay : false
    timeToggle.append(timed, el('span', '', 'Указать время события'))
    const startTimeInput = this.field('Время начала', 'time', existing?.startTime ?? '09:00')
    const endTimeInput = this.field('Время окончания · необязательно', 'time', existing?.endTime ?? '')
    const timeFields = el('div', 'field-row time-fields')
    timeFields.append(startTimeInput.label, endTimeInput.label)
    const syncTimeFields = () => {
      timeFields.hidden = !timed.checked
      startTimeInput.input.disabled = !timed.checked
      endTimeInput.input.disabled = !timed.checked
      startTimeInput.input.required = timed.checked
    }
    timed.addEventListener('change', syncTimeFields)
    syncTimeFields()
    titleInput.input.addEventListener('input', () => titleInput.input.setCustomValidity(''))
    for (const input of [startInput.input, endInput.input]) {
      input.addEventListener('input', () => startInput.input.setCustomValidity(''))
    }
    for (const input of [startTimeInput.input, endTimeInput.input]) {
      input.addEventListener('input', () => endTimeInput.input.setCustomValidity(''))
    }
    const calendarLabel = el('label', 'field')
    calendarLabel.append(el('span', '', 'Календарь'))
    const calendarSelect = el('select')
    for (const calendar of this.state.calendars) {
      const option = el('option', '', calendar.name)
      option.value = calendar.id
      option.selected = calendar.id === existing?.calendarId
      calendarSelect.append(option)
    }
    calendarLabel.append(calendarSelect)
    const cityLabel = el('label', 'field')
    cityLabel.append(el('span', '', 'Город'))
    const citySelect = el('select')
    const noCity = el('option', '', 'Без города')
    noCity.value = ''
    citySelect.append(noCity)
    const countryOrder = ['Россия', ...new Set(plannerCities.filter(({ country }) => country !== 'Россия').map(({ country }) => country))]
    for (const country of countryOrder) {
      const group = el('optgroup')
      group.label = country
      for (const city of [...plannerCities.filter((item) => item.country === country)].sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
        const option = el('option', '', city.name)
        option.value = city.id
        option.selected = city.id === existing?.cityId
        group.append(option)
      }
      citySelect.append(group)
    }
    cityLabel.append(citySelect)
    const repeatLabel = el('label', 'field')
    repeatLabel.append(el('span', '', 'Повтор'))
    const repeat = el('select')
    ;[['', 'Не повторять'], ['weekly', 'Каждую неделю'], ['monthly', 'Каждый месяц'], ['yearly', 'Каждый год']].forEach(([value, label]) => {
      const option = el('option', '', label)
      option.value = value
      option.selected = value === existing?.recurrence?.frequency
      repeat.append(option)
    })
    repeatLabel.append(repeat)
    const description = el('label', 'field')
    description.append(el('span', '', 'Заметка'))
    const textarea = el('textarea')
    textarea.value = existing?.description ?? ''
    textarea.maxLength = 10_000
    description.append(textarea)
    const actions = el('div', 'dialog-actions')
    if (existing) actions.append(this.textButton('Удалить', async () => {
      dialog.close()
      if (await this.confirmAction('Удалить событие?', `«${existing.title}» исчезнет из календаря. Это действие нельзя отменить.`)) {
        await this.commit({ ...this.state, events: this.state.events.filter(({ id }) => id !== existing.id) })
      }
    }, 'danger-button'))
    const cancel = this.textButton('Отмена', () => dialog.close(), 'secondary-button')
    const submit = el('button', 'primary-button', 'Сохранить')
    submit.type = 'submit'
    actions.append(cancel, submit)
    const dateFields = el('div', 'field-row')
    dateFields.append(startInput.label, endInput.label)
    form.append(heading, titleInput.label, dateFields, timeToggle, timeFields)
    form.append(calendarLabel, cityLabel, repeatLabel, description, actions)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const normalizedTitle = titleInput.input.value.trim()
      if (!normalizedTitle) { titleInput.input.setCustomValidity('Введите название события'); titleInput.input.reportValidity(); return }
      titleInput.input.setCustomValidity('')
      startInput.input.setCustomValidity('')
      endTimeInput.input.setCustomValidity('')
      const startDate = startInput.input.value as LocalDate
      const endDateExclusive = addDays(endInput.input.value as LocalDate, 1)
      if (endDateExclusive <= startDate) { startInput.input.setCustomValidity('Начало должно быть не позже последнего дня'); startInput.input.reportValidity(); return }
      const now = new Date().toISOString()
      const saved: PlannerEvent = {
        id: existing?.id ?? crypto.randomUUID(),
        calendarId: calendarSelect.value,
        title: normalizedTitle,
        description: textarea.value.trim(),
        startDate,
        endDateExclusive,
        allDay: !timed.checked,
        ...(timed.checked ? {
          startTime: parseLocalTime(startTimeInput.input.value),
          ...(endTimeInput.input.value ? { endTime: parseLocalTime(endTimeInput.input.value) } : {}),
        } : {}),
        ...(repeat.value ? { recurrence: { frequency: repeat.value as 'weekly' | 'monthly' | 'yearly', interval: 1 } } : {}),
        ...(citySelect.value ? { cityId: citySelect.value } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      try { validateEventTiming(saved) }
      catch (error) { endTimeInput.input.setCustomValidity(error instanceof Error ? error.message : String(error)); endTimeInput.input.reportValidity(); return }
      const events = existing ? this.state.events.map((item) => item.id === existing.id ? saved : item) : [...this.state.events, saved]
      dialog.close()
      await this.commit({ ...this.state, events })
    })
    dialog.replaceChildren(form)
    dialog.showModal()
    titleInput.input.focus()
  }

  private renderCalendarDialog(): HTMLDialogElement {
    const dialog = el('dialog', 'dialog')
    dialog.id = 'calendar-dialog'
    dialog.setAttribute('aria-labelledby', 'calendar-dialog-title')
    return dialog
  }

  private openCalendarDialog(existing?: PlannerCalendar): void {
    const dialog = document.querySelector<HTMLDialogElement>('#calendar-dialog')
    if (!dialog) return
    const form = el('form', 'dialog-form')
    const heading = el('div', 'dialog-heading')
    const title = el('h2', '', existing ? 'Изменить календарь' : 'Новый календарь')
    title.id = 'calendar-dialog-title'
    heading.append(title, this.iconButton('×', 'Закрыть', () => dialog.close()))
    const name = this.field('Название', 'text', existing?.name ?? '')
    name.input.required = true
    name.input.addEventListener('input', () => name.input.setCustomValidity(''))
    const colours = el('fieldset', 'color-field')
    colours.append(el('legend', '', 'Цвет'))
    const availableColours = existing && !PALETTE.some((color) => color === existing.color)
      ? [existing.color, ...PALETTE]
      : [...PALETTE]
    availableColours.forEach((color, index) => {
      const label = el('label', 'color-choice')
      const input = el('input')
      input.type = 'radio'; input.name = 'color'; input.value = color; input.checked = existing ? existing.color === color : index === 0
      const swatch = el('span'); swatch.style.backgroundColor = color
      label.append(input, swatch); colours.append(label)
    })
    const actions = el('div', 'dialog-actions')
    if (existing) {
      const eventCount = this.state.events.filter((item) => item.calendarId === existing.id).length
      const remove = this.textButton('Удалить', async () => {
        const eventsLabel = eventCount === 0 ? 'связанных событий нет' : `будет удалено событий: ${eventCount}`
        dialog.close()
        if (!await this.confirmAction('Удалить календарь?', `«${existing.name}»: ${eventsLabel}. Это действие нельзя отменить.`)) return
        await this.commit(deleteCalendar(this.state, existing.id))
      }, 'danger-button')
      remove.disabled = this.state.calendars.length === 1
      if (remove.disabled) remove.title = 'Сначала создайте другой календарь'
      actions.append(remove)
    }
    actions.append(this.textButton('Отмена', () => dialog.close(), 'secondary-button'), Object.assign(el('button', 'primary-button', existing ? 'Сохранить' : 'Создать'), { type: 'submit' }))
    form.append(heading, name.label, colours, actions)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const normalizedName = name.input.value.trim()
      if (!normalizedName) {
        name.input.setCustomValidity('Введите название календаря')
        name.input.reportValidity()
        return
      }
      name.input.setCustomValidity('')
      const color = parseCalendarColor(new FormData(form).get('color'))
      if (existing) {
        dialog.close()
        await this.commit(updateCalendarDetails(this.state, existing.id, normalizedName, color))
        return
      }
      const now = new Date().toISOString()
      const calendar: PlannerCalendar = { id: crypto.randomUUID(), name: normalizedName, color, visible: true, createdAt: now }
      dialog.close()
      await this.commit({ ...this.state, calendars: [...this.state.calendars, calendar] })
    })
    dialog.replaceChildren(form); dialog.showModal(); name.input.focus()
  }

  private field(labelText: string, type: string, value: string): { label: HTMLLabelElement; input: HTMLInputElement } {
    const label = el('label', 'field')
    label.append(el('span', '', labelText))
    const input = el('input')
    input.type = type; input.value = value
    label.append(input)
    return { label, input }
  }

  private selectControl(labelText: string, values: string[][], selected: string, onChange: (value: string) => void): HTMLLabelElement {
    const label = el('label', 'compact-field')
    label.append(el('span', 'sr-only', labelText))
    const select = el('select')
    values.forEach(([value, text]) => {
      const option = el('option', '', text); option.value = value; option.selected = value === selected; select.append(option)
    })
    select.addEventListener('change', () => onChange(select.value))
    label.append(select)
    return label
  }

  private iconButton(text: string, label: string, action: () => void): HTMLButtonElement {
    const button = el('button', 'icon-button', text)
    button.type = 'button'; button.setAttribute('aria-label', label); button.addEventListener('click', action)
    return button
  }

  private textButton(text: string, action: () => void | Promise<void>, className = 'text-button'): HTMLButtonElement {
    const button = el('button', className, text)
    button.type = 'button'; button.addEventListener('click', () => void action())
    return button
  }

  private onDateKey(event: KeyboardEvent, date: LocalDate): void {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectedDate = date; this.render(); return }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); this.openEventDialog(date); return }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    let next = addDays(date, offset)
    if (this.periodScope === 'custom') {
      for (let attempts = 0; attempts < 53 && parseLocalDate(next).getUTCFullYear() === this.year && !this.dateIsActive(next); attempts += 1) {
        next = addDays(next, offset)
      }
    }
    const nextYear = parseLocalDate(next).getUTCFullYear()
    if (!isDateInScope(next, nextYear, this.periodScope, this.customMonths)) return
    if (nextYear !== this.year) this.year = nextYear
    this.selectedDate = next
    this.render()
    requestAnimationFrame(() => this.focusDate(next))
  }

  private focusDate(date: LocalDate): void {
    if (!this.dateIsActive(date)) return
    this.selectedDate = date
    document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus()
  }

  private async enterFullScreen(): Promise<void> {
    requestFullView()
    if (document.fullscreenEnabled && window.parent === window) {
      try { await document.documentElement.requestFullscreen() } catch { /* user may decline */ }
    }
  }
}
