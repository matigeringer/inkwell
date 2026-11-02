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
import { loadPreferences } from './lib/preferences'

const initialPreferences = loadPreferences()
const initialMode =
  initialPreferences.mode === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : initialPreferences.mode
document.documentElement.setAttribute('data-theme', `puro-${initialMode}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
