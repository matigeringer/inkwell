import { useEffect } from 'react'

export default function useAppShortcuts({
  isEditing,
  activeFolder,
  workspaceSearch,
  addMenuOpen,
  setAddMenuOpen,
  createDocument,
  openFileDialog,
  openFolder
}) {
  const { isOpen, scope, open, close } = workspaceSearch
  const folderPath = activeFolder?.path

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return

      const primary = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (
        primary &&
        event.altKey &&
        !event.shiftKey &&
        !event.isComposing &&
        !event.getModifierState('AltGraph') &&
        (event.code === 'KeyF' || key === 'f')
      ) {
        const searchScope = isOpen
          ? scope
          : folderPath && { path: folderPath, rootPath: folderPath }
        if (!searchScope) return
        event.preventDefault()
        setAddMenuOpen(false)
        open(searchScope)
        return
      }
      if (isEditing) return
      if (event.key === 'Escape' && isOpen && !event.isComposing && !addMenuOpen) {
        event.preventDefault()
        close()
        return
      }

      if (!primary) return
      if (key === 'n' && !event.shiftKey) {
        event.preventDefault()
        createDocument()
      } else if (key === 'o') {
        event.preventDefault()
        if (event.shiftKey) openFolder()
        else openFileDialog()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isEditing,
    isOpen,
    scope,
    open,
    close,
    folderPath,
    addMenuOpen,
    setAddMenuOpen,
    createDocument,
    openFileDialog,
    openFolder
  ])
}
