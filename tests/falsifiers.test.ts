import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { providerCapabilities } from '../src/sync/provider'

const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

describe('first-slice falsifiers', () => {
  it('does not market provider sync as supported', () => {
    expect(providerCapabilities).toHaveLength(2)
    expect(providerCapabilities.every(({ status, detail }) => status === 'UNVERIFIED' && detail.includes('NOT IMPLEMENTED'))).toBe(true)
  })

  it('runtime cache is an explicit shell allowlist, excluding user and provider data', () => {
    expect(serviceWorker).toContain('function isShellAsset')
    expect(serviceWorker).toContain("if (!isShellAsset(url.pathname)) return")
    expect(serviceWorker).toContain("'/assets/app.js'")
    expect(serviceWorker).toContain("'/assets/app.css'")
    for (const path of ['/calendar.ics', '/backup.dplan', '/provider/caldav', '/anything.json']) {
      const shell = ['/', '/index.html', '/manifest.webmanifest', '/digitable-logo-96.png', '/digitable-logo-192.png', '/digitable-logo-512.png', '/digitable-logo-maskable-512.png'].includes(path)
        || /^\/assets\/[^/]+\.(?:js|css|map)$/.test(path)
      expect(shell, path).toBe(false)
    }
  })
})
