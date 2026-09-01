import 'leaflet/dist/leaflet.css'
import './styles.css'
import { PlannerApp } from './planner-app'
import { isEmbedPath } from './embed'

const releaseUrl = new URL(window.location.href)
const embedded = isEmbedPath(releaseUrl.pathname)
document.documentElement.dataset.embed = embedded ? 'true' : 'false'
if (releaseUrl.searchParams.has('release')) {
  releaseUrl.searchParams.delete('release')
  history.replaceState(null, '', `${releaseUrl.pathname}${releaseUrl.search}${releaseUrl.hash}`)
}

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('App root is missing')

const app = new PlannerApp(root, embedded)
void app.start()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
