export const THEME_IDS = ['puro', 'mono', 'beige']
export const PREFERENCES_KEY = 'fountain_preferences'
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'
export const FONT_SIZES = [
  '1.00rem',
  '1.10rem',
  '1.25rem',
  '1.40rem',
  '1.60rem',
  '1.80rem',
  '2.00rem',
  '2.40rem'
]

export const DEFAULT_PREFERENCES = {
  version: 1,
  theme: 'puro',
  mode: 'light',
  fontFamily: 'serif',
  fontSize: '1.40rem',
  textAlign: 'left',
  typewriterMode: false,
  typewriterPosition: 'center',
  typewriterBehavior: 'deadzone',
  language: 'system',
  spellcheckEnabled: true,
  autoSaveEnabled: true,
  autoSaveDelay: 2500,
  historyEnabled: true,
  historyMaxEntries: 50,
  historySnapshotInterval: 120000,
  zenShowToolbar: true,
  zenShowStats: true,
  zenShowFolder: true
}
const choices = {
  theme: THEME_IDS,
  mode: ['light', 'dark', 'system'],
  fontFamily: ['serif', 'sans', 'mono'],
  textAlign: ['left', 'justify', 'center'],
  typewriterPosition: ['center', 'eye'],
  typewriterBehavior: ['deadzone', 'strict'],
  language: ['system', 'es', 'en'],
  fontSize: FONT_SIZES
}
export function normalizePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...DEFAULT_PREFERENCES }
  const result = { ...DEFAULT_PREFERENCES }
  if (!input.version && ['light', 'dark'].includes(input.theme))
    input = { ...input, mode: input.theme }
  for (const [key, allowed] of Object.entries(choices))
    if (allowed.includes(input[key])) result[key] = input[key]
  for (const [key, value] of Object.entries(DEFAULT_PREFERENCES)) {
    if (typeof value === 'boolean' && typeof input[key] === 'boolean') result[key] = input[key]
  }
  for (const [key, min, max] of [
    ['autoSaveDelay', 250, 60000],
    ['historyMaxEntries', 5, 500],
    ['historySnapshotInterval', 10000, 3600000]
  ]) {
    const number = Number(input[key])
    if (Number.isFinite(number) && number > 0)
      result[key] = Math.min(max, Math.max(min, Math.floor(number)))
  }
  return result
}

export function loadPreferences(storage = localStorage) {
  try {
    return normalizePreferences(JSON.parse(storage.getItem(PREFERENCES_KEY) || 'null'))
  } catch (error) {
    console.warn('No se pudieron recuperar preferencias:', error.message)
    return { ...DEFAULT_PREFERENCES }
  }
}

export function resolveColorMode(mode, systemDark) {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}
