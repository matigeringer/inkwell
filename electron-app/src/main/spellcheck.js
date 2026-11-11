import { Menu, MenuItem, session } from 'electron'

export function registerSpellcheckIpc({ handle }) {
  const spellchecker = session.defaultSession
  let language = 'es'
  const getLanguage = () => language

  const setLanguage = (value) => {
    language = value === 'en' ? 'en' : 'es'
    try {
      spellchecker.setSpellCheckerLanguages(language === 'en' ? ['en-US', 'en'] : ['es-ES', 'es'])
    } catch (error) {
      console.error('Could not set spellchecker languages:', error)
    }
  }

  const getConfig = () => ({
    success: true,
    currentAppLanguage: language,
    languages: spellchecker.getSpellCheckerLanguages(),
    enabled: spellchecker.isSpellCheckerEnabled()
  })

  setLanguage(language)
  handle('spellcheck:set-config', (_event, { language, enabled } = {}) => {
    if (language) setLanguage(language)
    if (typeof enabled === 'boolean') spellchecker.setSpellCheckerEnabled(enabled)
    return getConfig()
  })
  handle('spellcheck:get-config', () => ({
    ...getConfig(),
    available: spellchecker.getAvailableSpellCheckerLanguages()
  }))
  handle('app:set-language', (_event, value) => {
    setLanguage(value)
    return { success: true, currentAppLanguage: language }
  })

  return getLanguage
}

export function installContextMenu(window, getLanguage) {
  const contents = window.webContents
  contents.on('context-menu', (_event, params) => {
    const menu = new Menu()
    const english = getLanguage() === 'en'
    const add = (options) => menu.append(new MenuItem(options))
    const separator = () => add({ type: 'separator' })
    const command = (role, englishLabel, spanishLabel, enabled = true) =>
      add({ role, label: english ? englishLabel : spanishLabel, enabled })
    const { misspelledWord, dictionarySuggestions, isEditable, editFlags, selectionText } = params

    if (misspelledWord) {
      if (dictionarySuggestions?.length) {
        for (const suggestion of dictionarySuggestions) {
          add({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) })
        }
      } else {
        add({
          label: english ? 'No spelling suggestions' : 'Sin sugerencias ortográficas',
          enabled: false
        })
      }
      separator()
      add({
        label: english
          ? `Add "${misspelledWord}" to dictionary`
          : `Agregar "${misspelledWord}" al diccionario`,
        click: () => contents.session.addWordToSpellCheckerDictionary(misspelledWord)
      })
      separator()
    }

    if (isEditable) {
      command('undo', 'Undo', 'Deshacer')
      command('redo', 'Redo', 'Rehacer')
      separator()
      command('cut', 'Cut', 'Cortar', Boolean(editFlags?.canCut))
      command('copy', 'Copy', 'Copiar', Boolean(editFlags?.canCopy))
      command('paste', 'Paste', 'Pegar', Boolean(editFlags?.canPaste))
      separator()
      command('selectAll', 'Select All', 'Seleccionar todo')
    } else if (selectionText?.trim()) {
      command('copy', 'Copy', 'Copiar')
      command('selectAll', 'Select All', 'Seleccionar todo')
    }

    if (menu.items.length > 0) menu.popup({ window })
  })
}
