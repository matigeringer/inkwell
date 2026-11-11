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
import { loadPreferences, resolveColorMode, SYSTEM_DARK_QUERY } from './lib/preferences'

// Apply the saved theme before React mounts to avoid a flash of the default theme.
const initialPreferences = loadPreferences()
const initialMode = resolveColorMode(
  initialPreferences.mode,
  window.matchMedia(SYSTEM_DARK_QUERY).matches
)
document.documentElement.setAttribute('data-theme', `${initialPreferences.theme}-${initialMode}`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
