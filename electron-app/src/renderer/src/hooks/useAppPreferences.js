import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  loadPreferences,
  normalizePreferences,
  PREFERENCES_KEY,
  resolveColorMode,
  SYSTEM_DARK_QUERY
} from '../lib/preferences'

const EDITOR_FONTS = {
  serif: 'var(--font-serif)',
  sans: 'var(--font-ui)',
  mono: 'var(--font-mono)'
}

function withThemeTransition(update) {
  if (
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}

export default function useAppPreferences(onError) {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(SYSTEM_DARK_QUERY).matches)
  const { theme, mode, fontFamily, fontSize, textAlign, spellcheckEnabled } = preferences
  const languagePreference = preferences.language
  const language =
    languagePreference === 'system' ? (window.api?.systemLanguage ?? 'en') : languagePreference
  const resolvedPreferences = useMemo(() => ({ ...preferences, language }), [preferences, language])
  const isDark = resolveColorMode(mode, systemDark) === 'dark'

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = `${theme}-${isDark ? 'dark' : 'light'}`
    window.api?.setWindowTheme?.(mode)
  }, [theme, mode, isDark])

  useLayoutEffect(() => {
    const { style } = document.documentElement
    style.setProperty('--font-editor', EDITOR_FONTS[fontFamily])
    style.setProperty('--font-size-editor', fontSize)
    style.setProperty('--text-align-editor', textAlign)
  }, [fontFamily, fontSize, textAlign])

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    } catch (error) {
      queueMicrotask(() => onError(error.message))
    }
  }, [preferences, onError])

  useEffect(() => {
    document.documentElement.lang = language
    window.api?.setSpellCheckerConfig?.({ language, enabled: spellcheckEnabled }).catch((error) => {
      console.error('Could not sync spellchecker preferences:', error)
    })
  }, [language, spellcheckEnabled])

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    const sync = () => {
      const update = () => setSystemDark(media.matches)
      if (mode === 'system') withThemeTransition(update)
      else update()
    }
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [mode])

  const updatePreferences = useCallback(
    (updates) => {
      const update = () =>
        setPreferences((current) => normalizePreferences({ ...current, ...updates }))
      const changesTheme =
        (updates.mode !== undefined && updates.mode !== mode) ||
        (updates.theme !== undefined && updates.theme !== theme)
      if (changesTheme) withThemeTransition(update)
      else update()
    },
    [mode, theme]
  )

  const toggleTheme = () => updatePreferences({ mode: isDark ? 'light' : 'dark' })
  const toggleLanguage = () => updatePreferences({ language: language === 'en' ? 'es' : 'en' })

  return {
    preferences: resolvedPreferences,
    languagePreference,
    isDark,
    updatePreferences,
    toggleTheme,
    toggleLanguage
  }
}
