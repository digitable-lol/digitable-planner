import { createBackup, previewBackup, restoreAsCopy, type RestorePreview } from './data/backup'
import { getCity, plannerCities, projectCity } from './data/cities'
import { exportIcs, importIcs } from './data/ical'
import { addDays, isWeekend, localDate, parseLocalDate, todayLocal } from './domain/dates'
import { cityEventGroups } from './domain/city-map'
import { expandEvent } from './domain/recurrence'
import { blankState, parseCalendarColor, PALETTE, type LocalDate, type PlannerCalendar, type PlannerEvent, type PlannerState } from './domain/types'
import { installEmbedContract, requestFullView } from './embed'
import { PlannerDatabase } from './storage/idb'
import { PlannerStateSync } from './storage/state-sync'
import { providerCapabilities } from './sync/provider'

type ViewMode = 'year' | 'flow' | 'map'
type DisplayMode = 'banners' | 'heatmap'
type AppSection = 'planner' | 'settings'

const monthNames = new Intl.DateTimeFormat('ru-RU', { month: 'long' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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
  private selectedDate: LocalDate = todayLocal()
  private section: AppSection = 'planner'
  private viewMode: ViewMode = 'year'
  private displayMode: DisplayMode = 'banners'
  private persistenceError = ''
  private restorePreview?: RestorePreview
  private installPrompt?: Event & { prompt(): Promise<void> }
  private selectedCityId?: string

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
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
    })
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
    document.documentElement.dataset.plannerView = this.section === 'planner' ? this.viewMode : 'page'
    this.root.replaceChildren()
    const shell = el('div', 'app-shell')
    shell.append(this.renderHeader())
    if (this.persistenceError) {
      const warning = el('div', 'notice notice--danger', this.persistenceError)
      warning.setAttribute('role', 'alert')
      shell.append(warning)
    }
    shell.append(this.section === 'planner' ? this.renderPlanner() : this.renderSettings())
    this.root.append(shell, this.renderEventDialog(), this.renderCalendarDialog())
  }

  private renderHeader(): HTMLElement {
    const header = el('header', 'topbar')
    const brand = el('button', 'brand')
    brand.type = 'button'
    brand.setAttribute('aria-label', 'Открыть планировщик')
    brand.innerHTML = '<img class="brand__logo" src="/digitable-logo-96.png" alt=""><span>Digitable <strong>Planner</strong></span>'
    brand.addEventListener('click', () => { this.section = 'planner'; this.render() })
    const nav = el('nav', 'topnav')
    nav.setAttribute('aria-label', 'Основная навигация')
    const planner = this.headerButton('Год', this.section === 'planner', () => { this.section = 'planner'; this.render() })
    const settings = this.headerButton('Данные и подключения', this.section === 'settings', () => { this.section = 'settings'; this.render() })
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
    const main = el('main', `workspace workspace--${this.viewMode}`)
    main.id = 'planner'
    main.tabIndex = -1
    const toolbar = el('section', 'toolbar')
    toolbar.setAttribute('aria-label', 'Управление годом')
    const yearControl = el('div', 'year-control')
    yearControl.append(
      this.iconButton('←', 'Предыдущий год', () => { this.year -= 1; this.render() }),
      el('h1', 'year-title', String(this.year)),
      this.iconButton('→', 'Следующий год', () => { this.year += 1; this.render() }),
      this.textButton('Сегодня', () => { this.year = new Date().getFullYear(); this.selectedDate = todayLocal(); this.render() }),
    )
    const modes = el('div', 'mode-controls')
    const viewSelect = this.selectControl('Раскладка', [['year', '12 месяцев'], ['flow', 'Лента'], ['map', 'Карта']], this.viewMode, (value) => { this.viewMode = value as ViewMode; this.render() })
    const displaySelect = this.selectControl('События', [['banners', 'Плашки'], ['heatmap', 'Нагрузка']], this.displayMode, (value) => { this.displayMode = value as DisplayMode; this.render() })
    const full = this.textButton('На весь экран', () => this.enterFullScreen())
    modes.append(viewSelect, displaySelect, full, this.textButton('+ Событие', () => this.openEventDialog(this.selectedDate)))
    toolbar.append(yearControl, modes)

    const layout = el('div', `planner-layout${this.viewMode === 'map' ? ' planner-layout--map' : ''}`)
    layout.append(this.renderSidebar())
    const content = this.viewMode === 'map' ? this.renderMap() : el('section', `months months--${this.viewMode}`)
    if (this.viewMode !== 'map') {
      content.setAttribute('aria-label', `Календарь на ${this.year} год`)
      for (let month = 0; month < 12; month += 1) content.append(this.renderMonth(month))
    }
    layout.append(content, this.renderDayPanel())
    main.append(toolbar, layout)
    return main
  }

  private renderSidebar(): HTMLElement {
    const aside = el('aside', 'calendars-panel')
    const title = el('div', 'panel-heading')
    title.append(el('h2', '', 'Календари'), this.iconButton('+', 'Добавить календарь', () => this.openCalendarDialog()))
    aside.append(title)
    for (const calendar of this.state.calendars) {
      const row = el('label', 'calendar-row')
      const checkbox = el('input')
      checkbox.type = 'checkbox'
      checkbox.checked = calendar.visible
      checkbox.addEventListener('change', () => void this.commit({ ...this.state, calendars: this.state.calendars.map((item) => item.id === calendar.id ? { ...item, visible: checkbox.checked } : item) }))
      const dot = el('span', 'calendar-dot')
      dot.style.backgroundColor = calendar.color
      row.append(checkbox, dot, el('span', '', calendar.name))
      aside.append(row)
    }
    const note = el('p', 'microcopy', 'Хранится только в этом браузере. Экспортируйте резервную копию.')
    aside.append(note)
    return aside
  }

  private renderMap(): HTMLElement {
    const pane = el('section', 'city-map-pane')
    pane.setAttribute('aria-label', `Карта событий на ${this.year} год`)
    const groups = cityEventGroups(this.state, this.year)
    if (this.selectedCityId && !groups.some(({ city }) => city.id === this.selectedCityId)) this.selectedCityId = undefined
    const active = groups.find(({ city }) => city.id === this.selectedCityId) ?? groups[0]

    const heading = el('div', 'city-map-heading')
    const title = el('div')
    title.append(el('p', 'eyebrow', 'Где и когда'), el('h2', '', 'Карта года'))
    heading.append(title, el('p', 'microcopy', 'Локальная схема без тайлов, геолокации и сетевых запросов. Линия показывает хронологию, а не маршрут.'))

    const frame = el('div', 'city-map-frame')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 1000 500')
    svg.setAttribute('aria-hidden', 'true')
    svg.classList.add('city-map-svg')
    for (const latitude of [100, 200, 300, 400]) {
      const line = document.createElementNS(svg.namespaceURI, 'line')
      line.setAttribute('x1', '0'); line.setAttribute('x2', '1000'); line.setAttribute('y1', String(latitude)); line.setAttribute('y2', String(latitude))
      line.classList.add('map-grid-line'); svg.append(line)
    }
    for (const longitude of [125, 250, 375, 500, 625, 750, 875]) {
      const line = document.createElementNS(svg.namespaceURI, 'line')
      line.setAttribute('x1', String(longitude)); line.setAttribute('x2', String(longitude)); line.setAttribute('y1', '0'); line.setAttribute('y2', '500')
      line.classList.add('map-grid-line'); svg.append(line)
    }
    const land = document.createElementNS(svg.namespaceURI, 'path')
    land.setAttribute('d', 'M45 90 110 55 210 75 275 135 240 205 170 218 125 175 70 165ZM220 225 280 250 300 325 265 435 225 360 205 285ZM410 85 520 55 650 75 760 125 835 115 925 170 875 225 760 215 690 250 600 225 545 175 480 165ZM505 205 590 225 625 315 575 405 505 365 475 280ZM790 335 865 320 915 365 875 420 800 405Z')
    land.classList.add('map-land'); svg.append(land)
    if (groups.length > 1) {
      const route = document.createElementNS(svg.namespaceURI, 'polyline')
      route.setAttribute('points', groups.map(({ city }) => { const point = projectCity(city); return `${point.x},${point.y}` }).join(' '))
      route.classList.add('map-route'); svg.append(route)
    }
    frame.append(svg)

    for (const group of groups) {
      const point = projectCity(group.city)
      const marker = el('button', `city-marker${active?.city.id === group.city.id ? ' is-active' : ''}`)
      marker.type = 'button'
      marker.style.setProperty('--map-x', `${point.x / 10}%`)
      marker.style.setProperty('--map-y', `${point.y / 5}%`)
      marker.setAttribute('aria-label', `${group.city.name}: ${group.occurrences.length} событий в ${this.year} году`)
      marker.title = `${group.city.name} · ${group.occurrences.length}`
      marker.append(el('span', 'city-marker__dot', String(group.occurrences.length)), el('span', 'city-marker__label', group.city.name))
      marker.addEventListener('click', () => {
        this.selectedCityId = group.city.id
        this.selectedDate = group.occurrences[0].startDate
        this.render()
      })
      frame.append(marker)
    }

    const timeline = el('div', 'city-timeline')
    if (!active) {
      timeline.append(el('h3', '', 'На карте пока пусто'), el('p', 'empty-state', 'Выберите город в событии — он появится здесь вместе с датой и календарём.'))
    } else {
      const activeHeading = el('div', 'city-timeline__heading')
      activeHeading.append(el('h3', '', `${active.city.name}, ${active.city.country}`), el('span', 'status-badge status-badge--ready', `${active.occurrences.length} событий`))
      timeline.append(activeHeading, el('p', 'microcopy', `Часовой пояс: ${active.city.timeZone}. События пока остаются целодневными.`))
      for (const event of active.occurrences) {
        const card = el('button', 'city-event-card')
        card.type = 'button'
        const calendar = this.state.calendars.find(({ id }) => id === event.calendarId)
        card.style.setProperty('--event-color', calendar?.color ?? PALETTE[0])
        card.append(el('time', '', event.startDate), el('strong', '', event.title), el('span', '', calendar?.name ?? 'Календарь'))
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
    if (date === todayLocal()) cell.classList.add('is-today')
    if (date === this.selectedDate) cell.classList.add('is-selected')
    if (isWeekend(date)) cell.classList.add('is-weekend')
    const button = el('button', 'day-number', String(dayNumber))
    button.type = 'button'
    button.dataset.date = date
    button.setAttribute('aria-label', fullDate.format(parseLocalDate(date)))
    button.addEventListener('click', () => { this.selectedDate = date; this.render() })
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
        const eventButton = el('button', 'event-chip', `${event.startDate < date ? '← ' : ''}${event.title}${event.endDateExclusive > addDays(date, 1) ? ' →' : ''}`)
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
    const visible = new Set(this.state.calendars.filter(({ visible }) => visible).map(({ id }) => id))
    return this.state.events
      .filter(({ calendarId }) => visible.has(calendarId))
      .flatMap((event) => expandEvent(event, date, addDays(date, 1)))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }

  private renderDayPanel(): HTMLElement {
    const aside = el('aside', 'day-panel')
    const heading = el('div', 'panel-heading')
    heading.append(el('div', '', ''), this.iconButton('+', 'Добавить событие в этот день', () => this.openEventDialog(this.selectedDate)))
    heading.firstElementChild!.append(el('p', 'eyebrow', 'Выбранный день'), el('h2', '', fullDate.format(parseLocalDate(this.selectedDate))))
    aside.append(heading)
    const events = this.eventsForDate(this.selectedDate)
    if (!events.length) aside.append(el('p', 'empty-state', 'Пока свободно. Двойной щелчок по дню тоже создаёт событие.'))
    for (const event of events) {
      const card = el('button', 'agenda-card')
      card.type = 'button'
      const calendar = this.state.calendars.find(({ id }) => id === event.calendarId)
      const city = getCity(event.cityId)
      card.style.setProperty('--event-color', calendar?.color ?? PALETTE[0])
      card.append(el('strong', '', event.title), el('span', '', calendar?.name ?? 'Календарь'))
      if (city) card.append(el('span', '', `⌖ ${city.name}`))
      if (event.startDate !== addDays(event.endDateExclusive, -1)) card.append(el('span', '', `${event.startDate} — ${addDays(event.endDateExclusive, -1)}`))
      card.addEventListener('click', () => this.openEventDialog(this.selectedDate, event.id.split('::')[0]))
      aside.append(card)
    }
    return aside
  }

  private renderSettings(): HTMLElement {
    const main = el('main', 'settings-page')
    main.id = 'planner'
    main.tabIndex = -1
    const hero = el('section', 'settings-hero')
    hero.append(el('p', 'eyebrow', 'Ваши данные — ваши'), el('h1', '', 'Резервные копии и подключения'), el('p', 'lede', 'Планировщик работает без аккаунта. Мы не отправляем календарь, не ставим аналитику и не подключаем провайдеры скрыто.'))
    const grid = el('div', 'settings-grid')
    grid.append(this.renderBackupCard(), this.renderIcsCard(), this.renderProviderCard(), this.renderAppCard())
    hero.append(grid)
    main.append(hero)
    return main
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
      try { this.restorePreview = previewBackup(await readFile(file)); this.render() }
      catch (error) { alert(error instanceof Error ? error.message : String(error)) }
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
    this.section = 'planner'
    if (focusDate) {
      this.selectedDate = focusDate
      this.year = parseLocalDate(focusDate).getUTCFullYear()
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
        await this.commit({ ...this.state, events: [...this.state.events, ...events] })
      } catch (error) { alert(error instanceof Error ? error.message : String(error)) }
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
        alert('Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».')
      }
    }))
    card.append(this.textButton('На весь экран', () => this.enterFullScreen()))
    card.append(el('p', 'microcopy', 'Офлайн-оболочка сохраняется после первого успешного открытия. Календарные данные не попадают в кэш приложения.'))
    return card
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
    for (const city of plannerCities) {
      const option = el('option', '', `${city.name}, ${city.country}`)
      option.value = city.id
      option.selected = city.id === existing?.cityId
      citySelect.append(option)
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
      if (confirm(`Удалить «${existing.title}»?`)) { dialog.close(); await this.commit({ ...this.state, events: this.state.events.filter(({ id }) => id !== existing.id) }) }
    }, 'danger-button'))
    const cancel = this.textButton('Отмена', () => dialog.close(), 'secondary-button')
    const submit = el('button', 'primary-button', 'Сохранить')
    submit.type = 'submit'
    actions.append(cancel, submit)
    const dateFields = el('div', 'field-row')
    dateFields.append(startInput.label, endInput.label)
    form.append(heading, titleInput.label, dateFields)
    form.append(calendarLabel, cityLabel, repeatLabel, description, actions)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const startDate = startInput.input.value as LocalDate
      const endDateExclusive = addDays(endInput.input.value as LocalDate, 1)
      if (endDateExclusive <= startDate) { startInput.input.setCustomValidity('Начало должно быть не позже последнего дня'); startInput.input.reportValidity(); return }
      const now = new Date().toISOString()
      const saved: PlannerEvent = {
        id: existing?.id ?? crypto.randomUUID(),
        calendarId: calendarSelect.value,
        title: titleInput.input.value.trim(),
        description: textarea.value.trim(),
        startDate,
        endDateExclusive,
        allDay: true,
        ...(repeat.value ? { recurrence: { frequency: repeat.value as 'weekly' | 'monthly' | 'yearly', interval: 1 } } : {}),
        ...(citySelect.value ? { cityId: citySelect.value } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
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

  private openCalendarDialog(): void {
    const dialog = document.querySelector<HTMLDialogElement>('#calendar-dialog')
    if (!dialog) return
    const form = el('form', 'dialog-form')
    const heading = el('div', 'dialog-heading')
    const title = el('h2', '', 'Новый календарь')
    title.id = 'calendar-dialog-title'
    heading.append(title, this.iconButton('×', 'Закрыть', () => dialog.close()))
    const name = this.field('Название', 'text', '')
    name.input.required = true
    const colours = el('fieldset', 'color-field')
    colours.append(el('legend', '', 'Цвет'))
    PALETTE.forEach((color, index) => {
      const label = el('label', 'color-choice')
      const input = el('input')
      input.type = 'radio'; input.name = 'color'; input.value = color; input.checked = index === 0
      const swatch = el('span'); swatch.style.backgroundColor = color
      label.append(input, swatch); colours.append(label)
    })
    const actions = el('div', 'dialog-actions')
    actions.append(this.textButton('Отмена', () => dialog.close(), 'secondary-button'), Object.assign(el('button', 'primary-button', 'Создать'), { type: 'submit' }))
    form.append(heading, name.label, colours, actions)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const now = new Date().toISOString()
      const calendar: PlannerCalendar = { id: crypto.randomUUID(), name: name.input.value.trim(), color: parseCalendarColor(new FormData(form).get('color')), visible: true, createdAt: now }
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
    const next = addDays(date, offset)
    const nextYear = parseLocalDate(next).getUTCFullYear()
    if (nextYear !== this.year) { this.year = nextYear; this.render(); requestAnimationFrame(() => this.focusDate(next)); return }
    this.focusDate(next)
  }

  private focusDate(date: LocalDate): void {
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
