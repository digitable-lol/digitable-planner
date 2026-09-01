const TRUSTED_PARENT = 'https://courses.digitable.life'
const NAMESPACE = 'digitable-planner'

interface PlannerMessage {
  namespace: typeof NAMESPACE
  version: 1
  type: string
  payload: unknown
}

export function isEmbedPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/embed'
}

function isMessage(value: unknown): value is PlannerMessage {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.namespace === NAMESPACE && record.version === 1 && typeof record.type === 'string'
}

export function installEmbedContract(onTheme: (theme: 'light' | 'dark') => void): () => void {
  const embedded = window.parent !== window
  const receive = (event: MessageEvent<unknown>) => {
    if (!embedded || event.origin !== TRUSTED_PARENT || event.source !== window.parent || !isMessage(event.data)) return
    if (event.data.type === 'theme') {
      const payload = event.data.payload as { value?: unknown }
      if (payload?.value === 'light' || payload?.value === 'dark') onTheme(payload.value)
    }
  }
  window.addEventListener('message', receive)
  if (embedded) {
    const observer = new ResizeObserver(() => {
      const height = Math.max(320, Math.min(2400, document.documentElement.scrollHeight))
      window.parent.postMessage({ namespace: NAMESPACE, version: 1, type: 'size', payload: { height } }, TRUSTED_PARENT)
    })
    observer.observe(document.documentElement)
    return () => { window.removeEventListener('message', receive); observer.disconnect() }
  }
  return () => window.removeEventListener('message', receive)
}

export function requestFullView(): void {
  if (window.parent === window) return
  window.parent.postMessage({ namespace: NAMESPACE, version: 1, type: 'open', payload: { mode: 'full' } }, TRUSTED_PARENT)
}

export function requestCleanView(enabled: boolean): void {
  if (window.parent === window) return
  window.parent.postMessage({ namespace: NAMESPACE, version: 1, type: 'clean-view', payload: { enabled } }, TRUSTED_PARENT)
}
