import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { providerCapabilities } from '../src/sync/provider'

const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const citySource = readFileSync(new URL('../src/data/cities.ts', import.meta.url), 'utf8')
const plannerSource = readFileSync(new URL('../src/planner-app.ts', import.meta.url), 'utf8')
const pngSource = readFileSync(new URL('../src/export/png.ts', import.meta.url), 'utf8')

describe('first-slice falsifiers', () => {
  it('does not market provider sync as supported', () => {
    expect(providerCapabilities).toHaveLength(2)
    expect(providerCapabilities.every(({ status, detail }) => status === 'UNVERIFIED' && detail.includes('NOT IMPLEMENTED'))).toBe(true)
  })

  it('runtime cache is an explicit shell allowlist, excluding user and provider data', () => {
    expect(serviceWorker).toContain("'digitable-planner-shell-v10'")
    expect(serviceWorker).toContain("request.mode === 'navigate'")
    expect(serviceWorker).toContain("fetch(request).then")
    expect(serviceWorker).toContain("caches.match('/index.html')")
    expect(serviceWorker).toContain('function isShellAsset')
    expect(serviceWorker).toContain("if (!isShellAsset(url.pathname)) return")
    expect(serviceWorker.indexOf("request.mode === 'navigate'")).toBeLessThan(serviceWorker.indexOf("if (!isShellAsset(url.pathname)) return"))
    expect(serviceWorker).toContain("/^\\/assets\\/[^/]+\\.(?:js|css|map)$/")
    for (const path of ['/calendar.ics', '/backup.dplan', '/provider/caldav', '/anything.json']) {
      const shell = ['/', '/index.html', '/manifest.webmanifest', '/digitable-logo-96.png', '/digitable-logo-192.png', '/digitable-logo-512.png', '/digitable-logo-maskable-512.png'].includes(path)
        || /^\/assets\/[^/]+\.(?:js|css|map)$/.test(path)
      expect(shell, path).toBe(false)
    }
  })

  it('keeps the map local and free of tile, geolocation, and calendar payload channels', () => {
    const mapSources = `${citySource}\n${plannerSource}\n${pngSource}`
    expect(mapSources).not.toMatch(/mapbox|openstreetmap|googleapis|tileLayer|fetch\(/i)
    expect(mapSources).toContain("from 'leaflet'")
    expect(mapSources).toContain("world-atlas/countries-110m.json")
    expect(mapSources).not.toContain('geolocation')
    expect(citySource).not.toContain('https://')
    expect(citySource).not.toContain('fetch(')
  })
})
