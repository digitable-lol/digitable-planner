const CHANNEL_NAME = 'digitable-planner-state-v1'

const INVALIDATION_MESSAGE = Object.freeze({
  namespace: 'digitable-planner',
  version: 1,
  type: 'state-invalidated',
})

interface BroadcastPort {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
  postMessage(message: unknown): void
  close(): void
}

export type BroadcastPortFactory = (name: string) => BroadcastPort

function isInvalidationMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  return keys.length === 3
    && record.namespace === INVALIDATION_MESSAGE.namespace
    && record.version === INVALIDATION_MESSAGE.version
    && record.type === INVALIDATION_MESSAGE.type
}

export class PlannerStateSync {
  private readonly port: BroadcastPort
  private closed = false

  private readonly receive = (event: MessageEvent<unknown>): void => {
    if (!this.closed && isInvalidationMessage(event.data)) this.onInvalidate()
  }

  constructor(
    private readonly onInvalidate: () => void,
    factory: BroadcastPortFactory = (name) => new BroadcastChannel(name),
  ) {
    this.port = factory(CHANNEL_NAME)
    this.port.addEventListener('message', this.receive)
  }

  notifyChanged(): void {
    if (!this.closed) this.port.postMessage(INVALIDATION_MESSAGE)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.port.removeEventListener('message', this.receive)
    this.port.close()
  }
}
