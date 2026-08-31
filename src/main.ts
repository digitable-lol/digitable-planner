import './styles.css'
import { PlannerApp } from './planner-app'

const releaseUrl = new URL(window.location.href)
if (releaseUrl.searchParams.has('release')) {
  releaseUrl.searchParams.delete('release')
  history.replaceState(null, '', `${releaseUrl.pathname}${releaseUrl.search}${releaseUrl.hash}`)
}

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('App root is missing')

const app = new PlannerApp(root)
void app.start()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
