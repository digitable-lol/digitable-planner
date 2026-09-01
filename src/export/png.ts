export interface ExportPalette {
  background: string
  surface: string
  surfaceAlt: string
  text: string
  muted: string
  line: string
  accent: string
}

export interface CalendarPngEvent {
  date: string
  title: string
  color: string
  time?: string
}

export interface CalendarPngOptions {
  year: number
  monthIndexes: number[]
  events: CalendarPngEvent[]
  palette: ExportPalette
}

export interface RoutePngStop {
  number: number
  latitude: number
  longitude: number
  city: string
  country: string
  date: string
}

export interface RoutePngOptions {
  year: number
  level: 'world' | 'russia'
  stops: RoutePngStop[]
  palette: ExportPalette
  countryGeometry: FeatureCollection | Feature | Geometry
}

const months = new Intl.DateTimeFormat('ru-RU', { month: 'long' })
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Браузер не поддерживает PNG-экспорт')
  return { canvas, context }
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function ellipsis(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value
  let result = value
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

function localDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function renderCalendarPng(options: CalendarPngOptions): Promise<Blob> {
  const width = 2400
  const height = 1600
  const { canvas, context } = createCanvas(width, height)
  const { palette } = options
  context.fillStyle = palette.background
  context.fillRect(0, 0, width, height)
  context.fillStyle = palette.text
  context.font = '700 52px Georgia, serif'
  context.fillText(`Digitable Planner · ${options.year}`, 72, 78)
  context.fillStyle = palette.muted
  context.font = '500 22px Inter, sans-serif'
  context.fillText('Год целиком · локальный календарь', 74, 116)

  const visibleMonths = options.monthIndexes.length ? options.monthIndexes : [...Array(12).keys()]
  const columns = visibleMonths.length <= 4 ? visibleMonths.length : 4
  const rows = Math.ceil(visibleMonths.length / columns)
  const gap = 18
  const outerX = 68
  const top = 150
  const cardWidth = (width - outerX * 2 - gap * (columns - 1)) / columns
  const cardHeight = (height - top - 58 - gap * (rows - 1)) / rows
  const eventIndex = new Map<string, CalendarPngEvent[]>()
  for (const event of options.events) eventIndex.set(event.date, [...(eventIndex.get(event.date) ?? []), event])

  visibleMonths.forEach((monthIndex, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = outerX + column * (cardWidth + gap)
    const y = top + row * (cardHeight + gap)
    roundedRect(context, x, y, cardWidth, cardHeight, 20)
    context.fillStyle = palette.surface
    context.fill()
    context.strokeStyle = palette.line
    context.lineWidth = 2
    context.stroke()
    context.fillStyle = palette.text
    context.font = '600 27px Georgia, serif'
    context.fillText(months.format(new Date(Date.UTC(options.year, monthIndex, 1))), x + 20, y + 38)

    const gridX = x + 18
    const gridY = y + 56
    const cellWidth = (cardWidth - 36) / 7
    const cellHeight = (cardHeight - 76) / 7
    context.font = '700 13px Inter, sans-serif'
    weekdays.forEach((weekday, dayIndex) => {
      context.fillStyle = palette.muted
      context.textAlign = 'center'
      context.fillText(weekday, gridX + dayIndex * cellWidth + cellWidth / 2, gridY + 17)
    })
    const first = new Date(Date.UTC(options.year, monthIndex, 1))
    const offset = (first.getUTCDay() + 6) % 7
    const dayCount = new Date(Date.UTC(options.year, monthIndex + 1, 0)).getUTCDate()
    for (let day = 1; day <= dayCount; day += 1) {
      const cellIndex = offset + day - 1
      const weekday = cellIndex % 7
      const week = Math.floor(cellIndex / 7)
      const cellX = gridX + weekday * cellWidth
      const cellY = gridY + cellHeight + week * cellHeight
      if (weekday >= 5) {
        roundedRect(context, cellX + 2, cellY + 1, cellWidth - 4, cellHeight - 2, 7)
        context.fillStyle = palette.surfaceAlt
        context.fill()
      }
      context.textAlign = 'left'
      context.fillStyle = palette.text
      context.font = '500 14px Inter, sans-serif'
      context.fillText(String(day), cellX + 6, cellY + 18)
      const dayEvents = eventIndex.get(localDate(options.year, monthIndex, day)) ?? []
      dayEvents.slice(0, 2).forEach((event, eventIndex) => {
        const bannerY = cellY + 25 + eventIndex * 18
        roundedRect(context, cellX + 4, bannerY, cellWidth - 8, 15, 3)
        context.fillStyle = event.color
        context.globalAlpha = 0.18
        context.fill()
        context.globalAlpha = 1
        context.fillStyle = event.color
        context.fillRect(cellX + 4, bannerY, 3, 15)
        context.fillStyle = palette.text
        context.font = '600 10px Inter, sans-serif'
        context.fillText(ellipsis(context, `${event.time ? `${event.time} ` : ''}${event.title}`, cellWidth - 17), cellX + 10, bannerY + 11)
      })
    }
  })
  context.textAlign = 'left'
  context.fillStyle = palette.muted
  context.font = '500 18px Inter, sans-serif'
  context.fillText('Создано локально · без передачи календарных данных', 72, height - 24)
  return canvasBlob(canvas)
}

function forEachRing(geometry: Geometry, visit: (ring: Position[]) => void): void {
  if (geometry.type === 'Polygon') geometry.coordinates.forEach(visit)
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((polygon) => polygon.forEach(visit))
  else if (geometry.type === 'GeometryCollection') geometry.geometries.forEach((item) => forEachRing(item, visit))
}

function project(longitude: number, latitude: number, level: 'world' | 'russia', x: number, y: number, width: number, height: number): [number, number] {
  const bounds = level === 'russia'
    ? { west: 18, east: 180, south: 40, north: 82 }
    : { west: -180, east: 180, south: -82, north: 88 }
  return [
    x + ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    y + ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ]
}

export async function renderRoutePng(options: RoutePngOptions): Promise<Blob> {
  const width = 2400
  const height = 1350
  const { canvas, context } = createCanvas(width, height)
  const { palette } = options
  context.fillStyle = palette.background
  context.fillRect(0, 0, width, height)
  context.fillStyle = palette.text
  context.font = '700 52px Georgia, serif'
  context.fillText(`Карта путешествий · ${options.year}`, 72, 78)
  context.fillStyle = palette.muted
  context.font = '500 22px Inter, sans-serif'
  context.fillText(options.level === 'russia' ? 'Россия · города из событий' : 'Мир · города из событий', 74, 116)

  const mapX = 70
  const mapY = 150
  const mapWidth = width - 140
  const mapHeight = height - 240
  roundedRect(context, mapX, mapY, mapWidth, mapHeight, 22)
  context.fillStyle = palette.surface
  context.fill()
  context.save()
  context.clip()
  context.fillStyle = palette.surfaceAlt
  context.strokeStyle = palette.line
  context.lineWidth = 1.5
  const visitGeometry = (geometry: Geometry) => forEachRing(geometry, (ring) => {
    context.beginPath()
    ring.forEach(([longitude, latitude], index) => {
      const [x, y] = project(longitude, latitude, options.level, mapX, mapY, mapWidth, mapHeight)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
    context.fill()
    context.stroke()
  })
  if (options.countryGeometry.type === 'FeatureCollection') {
    for (const item of options.countryGeometry.features) if (item.geometry) visitGeometry(item.geometry)
  } else if (options.countryGeometry.type === 'Feature') {
    if (options.countryGeometry.geometry) visitGeometry(options.countryGeometry.geometry)
  } else visitGeometry(options.countryGeometry)

  const stops = options.level === 'russia' ? options.stops.filter(({ country }) => country === 'Россия') : options.stops
  context.strokeStyle = palette.accent
  context.lineWidth = 7
  context.setLineDash([16, 12])
  context.beginPath()
  stops.forEach((stop, index) => {
    const [x, y] = project(stop.longitude, stop.latitude, options.level, mapX, mapY, mapWidth, mapHeight)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
  context.setLineDash([])
  stops.forEach((stop) => {
    const [x, y] = project(stop.longitude, stop.latitude, options.level, mapX, mapY, mapWidth, mapHeight)
    context.beginPath()
    context.arc(x, y, 22, 0, Math.PI * 2)
    context.fillStyle = palette.accent
    context.fill()
    context.strokeStyle = palette.surface
    context.lineWidth = 7
    context.stroke()
    context.fillStyle = palette.background
    context.textAlign = 'center'
    context.font = '800 17px Inter, sans-serif'
    context.fillText(String(stop.number), x, y + 6)
    context.textAlign = 'left'
    context.fillStyle = palette.text
    context.font = '700 16px Inter, sans-serif'
    context.fillText(stop.city, x + 29, y - 2)
    context.fillStyle = palette.muted
    context.font = '500 13px Inter, sans-serif'
    context.fillText(stop.date, x + 29, y + 17)
  })
  context.restore()
  context.textAlign = 'left'
  context.fillStyle = palette.muted
  context.font = '500 18px Inter, sans-serif'
  context.fillText(`${stops.length} остановок · ${new Set(stops.map(({ country }) => country)).size} стран · офлайн`, 72, height - 42)
  return canvasBlob(canvas)
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG')), 'image/png'))
}
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
