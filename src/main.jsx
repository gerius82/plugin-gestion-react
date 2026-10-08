import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('No se pudo registrar la aplicación instalable:', error)
    })
  })
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__pluginInstallPrompt = event
  window.dispatchEvent(new CustomEvent('plugin-install-available', { detail: event }))
})

window.addEventListener('appinstalled', () => {
  window.__pluginInstallPrompt = null
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
