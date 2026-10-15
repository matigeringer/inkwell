import '@fontsource-variable/schibsted-grotesk/index.css'
import '@fontsource-variable/schibsted-grotesk/wght-italic.css'
import '@fontsource-variable/newsreader/index.css'
import '@fontsource-variable/newsreader/wght-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/400-italic.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Inicializar tema inmediatamente antes de montar para evitar FOUC o animaciones iniciales
try {
  const saved = localStorage.getItem('fountain_preferences')
  if (saved) {
    const parsed = JSON.parse(saved)
    let mode = parsed.mode || 'light'
    if (parsed.theme === 'dark') mode = 'dark'
    else if (parsed.theme === 'light') mode = 'light'
    if (mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    const theme = parsed.theme === 'gaceta' ? 'gaceta' : 'puro'
    document.documentElement.setAttribute('data-theme', `${theme}-${mode}`)
  }
} catch {
  // Ignorar error al leer preferencias iniciales
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
