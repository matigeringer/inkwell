import { Menu, MenuItem, session } from 'electron'

const ALLOWED_EDIT_ACTIONS = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])

export function registerSpellcheckIpc({ handle }, systemLanguage) {
  const spellchecker = session.defaultSession
  let language = systemLanguage
  const getLanguage = () => language

  const setLanguage = (value) => {
    language = value === 'en' || value === 'es' ? value : systemLanguage
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
    available: spellchecker.availableSpellCheckerLanguages
  }))
  handle('app:set-language', (_event, value) => {
    setLanguage(value)
    return { success: true, currentAppLanguage: language }
  })
  handle('context-menu:replace-misspelling', ({ sender }, word) => {
    if (typeof word !== 'string' || !word) throw new Error('Palabra de reemplazo inválida')
    sender.replaceMisspelling(word)
    return { success: true }
  })
  handle('context-menu:add-to-dictionary', ({ sender }, word) => {
    if (typeof word !== 'string' || !word.trim()) throw new Error('Palabra inválida')
    const added = sender.session.addWordToSpellCheckerDictionary(word.trim())
    return { success: Boolean(added) }
  })
  handle('context-menu:edit-action', ({ sender }, action) => {
    if (!ALLOWED_EDIT_ACTIONS.has(action)) throw new Error('Acción de edición inválida')
    sender[action]()
    return { success: true }
  })

  return getLanguage
}

export function installContextMenu(window, getLanguage) {
  const contents = window.webContents
  contents.on('context-menu', (_event, params) => {
    const { misspelledWord, dictionarySuggestions, isEditable, editFlags, selectionText, x, y } =
      params

    if (isEditable) {
      contents.send('editor:context-menu', {
        x,
        y,
        misspelledWord: misspelledWord || '',
        dictionarySuggestions: Array.isArray(dictionarySuggestions) ? dictionarySuggestions : [],
        selectionText: selectionText || '',
        editFlags: {
          canUndo: Boolean(editFlags?.canUndo),
          canRedo: Boolean(editFlags?.canRedo),
          canCut: Boolean(editFlags?.canCut),
          canCopy: Boolean(editFlags?.canCopy),
          canPaste: Boolean(editFlags?.canPaste),
          canSelectAll: Boolean(editFlags?.canSelectAll)
        }
      })
      return
    }

    const menu = new Menu()
    const english = getLanguage() === 'en'
    const add = (options) => menu.append(new MenuItem(options))
    const command = (role, englishLabel, spanishLabel, enabled = true) =>
      add({ role, label: english ? englishLabel : spanishLabel, enabled })

    if (selectionText?.trim()) {
      command('copy', 'Copy', 'Copiar')
      command('selectAll', 'Select All', 'Seleccionar todo')
    }

    if (menu.items.length > 0) menu.popup({ window })
  })
}
