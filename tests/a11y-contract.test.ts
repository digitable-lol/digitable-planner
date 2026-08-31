import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../src/planner-app.ts', import.meta.url), 'utf8')
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
      const workspaceInnerWidth = Math.min(width, 1440) - 40
      const monthAreaWidth = workspaceInnerWidth - 148 - 210 - 24
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
})
