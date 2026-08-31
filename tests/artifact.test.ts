import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('production artifact', () => {
  it('contains an installable offline shell and local app bundles', () => {
    expect(existsSync(new URL('../dist/index.html', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/manifest.webmanifest', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/sw.js', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/digitable-logo-96.png', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/digitable-logo-192.png', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/digitable-logo-512.png', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/digitable-logo-maskable-512.png', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../dist/icon.svg', import.meta.url))).toBe(false)
    const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('/digitable-logo-96.png')
    expect(html).toMatch(/\/assets\/app-[A-Za-z0-9_-]+\.js/)
    expect(html).toMatch(/\/assets\/app-[A-Za-z0-9_-]+\.css/)
    const manifest = readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8')
    expect(manifest).toContain('/digitable-logo-maskable-512.png')
    const assets = readdirSync(new URL('../dist/assets', import.meta.url))
    expect(assets.some((name) => name.endsWith('.js'))).toBe(true)
    expect(assets.some((name) => name.endsWith('.css'))).toBe(true)
    const bundles = assets.filter((name) => /\.(?:js|css)$/.test(name)).map((name) => readFileSync(new URL(`../dist/assets/${name}`, import.meta.url), 'utf8')).join('\n')
    expect(bundles).not.toMatch(/mapbox|openstreetmap|tile\.openstreetmap|maps\.googleapis/i)
  })
})
