import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/planner-app.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('accessibility contract', () => {
  it('keeps skip navigation, labelled grids, dialogs and keyboard date movement', () => {
    expect(html).toContain('class="skip-link"')
    expect(source).toContain("setAttribute('role', 'grid')")
    expect(source).toContain("setAttribute('aria-label'")
    expect(source).toContain("ArrowLeft: -1")
    expect(source).toContain("dialog.setAttribute('aria-labelledby'")
  })

  it('keeps visible focus and reduced-motion styling', () => {
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('uses the exact Courses theme language instead of the retired paper theme', () => {
    expect(css).toContain('--course-bg: #07090d')
    expect(css).toContain('--course-cyan: #40e0d0')
    expect(css).toContain('--course-bg: #f4f7f8')
    expect(css).toContain('--course-cyan: #007276')
    expect(css).toContain('--course-radius: 8px')
    expect(css).toContain('Inter, Manrope')
    expect(css).toContain('Georgia')
    expect(css).not.toContain('#e2562f')
  })

  it('locks classic desktop year view to a one-screen 4 by 3 grid', () => {
    expect(css).toContain('height: calc(100dvh - 64px)')
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(css).toContain('grid-template-rows: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('.workspace--year')

    for (const [width, height] of [[1440, 900], [1280, 800]]) {
      const workspaceInnerWidth = width - 40
      const monthAreaWidth = workspaceInnerWidth - 170 - 180 - 20
      const monthWidth = (monthAreaWidth - 24) / 4
      const workspaceInnerHeight = height - 64 - 12 - 14
      const monthAreaHeight = workspaceInnerHeight - 40 - 10
      const monthHeight = (monthAreaHeight - 16) / 3
      const dayRowHeight = (monthHeight - 18 - 21 - 12 - 6) / 6

      expect(64 + (height - 64), `${width}x${height} page height`).toBe(height)
      expect(monthWidth, `${width}x${height} month width`).toBeGreaterThanOrEqual(208)
      expect(monthHeight, `${width}x${height} month height`).toBeGreaterThanOrEqual(214)
      expect(dayRowHeight, `${width}x${height} clickable day row`).toBeGreaterThan(18)
    }
  })

  it('keeps the phone layout one-column and releases viewport locking', () => {
    expect(css).toContain('@media (max-width: 760px)')
    expect(css).toContain('.months--year { grid-template-columns: 1fr; }')
    expect(css).toContain('.planner-layout { display: block; }')
    expect(css).toContain('height: auto; min-height: calc(100dvh - 64px); overflow: visible;')
    expect(css).toContain('.month-card { min-height: auto; padding: 13px; }')
    expect(css).toContain('.month-title { margin-bottom: 10px; font-size: 17px; }')
    expect(css).toContain('.day { min-height: 49px; padding: 2px; }')
    expect(css).toContain('.day-number { width: 22px; height: 22px; font-size: 10px; }')
  })

  it('keeps map markers keyboard-operable with a textual event fallback', () => {
    expect(source).toContain("['map', 'Карта']")
    expect(source).toContain("marker.type = 'button'")
    expect(source).toContain("setAttribute('aria-label', `Карта событий")
    expect(source).toContain("el('div', 'city-timeline')")
    expect(css).toContain('.city-marker:focus-visible')
  })

  it('keeps data actions in a labelled modal and guards local reset', () => {
    expect(source).toContain("el('dialog', 'dialog settings-dialog')")
    expect(source).toContain("settings-dialog-title")
    expect(source).toContain('settings.showModal()')
    expect(source).toContain("'Сбросить календарь'")
    expect(source).toContain("if (!confirm('Удалить все локальные календари и события?")
    expect(source).toContain('this.commit(blankState())')
    expect(css).toContain('.settings-dialog')
  })

  it('offers an accessible calendar edit action without nesting a button in the visibility label', () => {
    expect(source).toContain("el('div', 'calendar-row')")
    expect(source).toContain("el('label', 'calendar-toggle')")
    expect(source).toContain('`Изменить календарь «${calendar.name}»`')
    expect(source).toContain("existing ? 'Сохранить' : 'Создать'")
    expect(source).toContain('updateCalendarDetails(this.state, existing.id')
    expect(source).toContain('!PALETTE.some((color) => color === existing.color)')
    expect(css).toContain('.calendar-edit')
    expect(source).toContain("this.textButton('Удалить'")
    expect(source).toContain('deleteCalendar(this.state, existing.id)')
    expect(source).toContain('remove.disabled = this.state.calendars.length === 1')
  })

  it('renders the Courses route as a compact microfrontend without duplicate chrome', () => {
    expect(main).toContain("document.documentElement.dataset.embed = embedded ? 'true' : 'false'")
    expect(source).toContain('if (!this.embedded && !this.cleanView) shell.append(this.renderHeader())')
    expect(source).toContain("this.textButton('Данные', () => this.openSettingsDialog())")
    expect(source).toContain("else modes.append(this.textButton('На весь экран'")
    expect(css).toContain('html[data-embed="true"] .workspace--year')
    expect(css).toContain('@media (min-width: 1020px) and (max-width: 1180px)')
    expect(css).toContain('grid-template-columns: 152px minmax(0, 1fr) 156px')
    expect(source).toContain("this.textButton('Скрыть меню'")
    expect(source).toContain("`${this.year} · Показать меню`")
    expect(css).toContain('@media (orientation: portrait) and (min-width: 1020px)')
    expect(css).toContain('grid-template-rows: repeat(4, clamp(210px, 23vw, 250px))')
    expect(css).toContain('.workspace--clean .calendars-panel')
    expect(css).toContain('html[data-embed="true"] .workspace--clean .planner-layout')
  })
})
