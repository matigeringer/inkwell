import { useEffect, useEffectEvent } from 'react'

function getCommand(event, isZenMode, commands) {
  const key = event.key.toLowerCase()
  const primary = event.ctrlKey || event.metaKey
  if (key === 'f11' || (primary && event.shiftKey && key === 'f')) return commands.toggleZen
  if (key === 'f1' || (primary && key === '/')) return commands.openHelp
  if (!primary) return

  if (key === 's') return event.shiftKey ? commands.saveAs : commands.save
  if (key === '+' || key === '=') return commands.increaseFontSize
  if (key === '-' || key === '_') return commands.decreaseFontSize
  if (key === '0') return commands.resetFontSize

  if (event.shiftKey) {
    if (key === 'y') return commands.toggleTypewriter
    if (key === 'c') return commands.toggleStats
    if (key === 't') return commands.toggleTheme
    if (key === 'l') return commands.cycleFont
    if (!isZenMode && key === 'e') return commands.toggleExport
  } else {
    if (key === 'f' && !event.altKey) return commands.openSearch
    if (key === 'h') return commands.openHistory
    if (key === ',' || key === '<') return commands.openPreferences
    if (!isZenMode && key === 'n') return commands.newDocument
    if (!isZenMode && key === '\\') return commands.toggleSidebar
    if (!isZenMode && key === 'p') return commands.toggleExport
  }

  if (isZenMode) return
  if (key === 'tab') return event.shiftKey ? commands.previousFolder : commands.nextFolder
  if (key === 'o') return event.shiftKey ? commands.openFolder : commands.openFile
}

export default function useEditorShortcuts({
  isZenMode,
  hideZenControls,
  dismissOverlay,
  commands
}) {
  const onKeyDown = useEffectEvent((event) => {
    if (event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
    hideZenControls()

    if (event.key === 'Escape') {
      if (dismissOverlay(event)) event.preventDefault()
      return
    }
    const command = getCommand(event, isZenMode, commands)
    if (command) {
      event.preventDefault()
      command()
    }
  })

  useEffect(() => {
    const listener = (event) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
