import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: offline shell + cached data. Never prompts to install (PRD §4.10).
// When a new version's worker installs behind a running session, tell the
// app so it can offer a one-tap refresh instead of silently lagging.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const fresh = reg.installing
          fresh?.addEventListener('statechange', () => {
            if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event('pmm-sw-updated'))
            }
          })
        })
      })
      .catch(() => {})
  })
}
