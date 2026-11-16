import { useEffect, useLayoutEffect, useRef } from 'react'
import { CommentAddIcon } from './Icons'

export default function EditorContextMenu({
  menu,
  labels,
  onClose,
  onComment,
  onReplaceMisspelling,
  onAddToDictionary,
  onEditAction
}) {
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el || !menu) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin)
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin)
    const left = Math.max(margin, Math.min(menu.x, maxLeft))
    const top = Math.max(margin, Math.min(menu.y, maxTop))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.focus({ preventScroll: true })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose()
      }
    }
    const handleDismiss = () => onClose()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('blur', handleDismiss)
    window.addEventListener('resize', handleDismiss)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('blur', handleDismiss)
      window.removeEventListener('resize', handleDismiss)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [menu, onClose])

  if (!menu) return null

  const { misspelledWord, dictionarySuggestions = [], editFlags = {}, canComment } = menu

  const handleMenuKeyDown = (event) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll('button[role="menuitem"]:not(:disabled)') || []
    )
    if (!items.length) return
    const index = items.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1) % items.length].focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items.at(-1).focus()
    }
  }

  const runAction = (action) => {
    onClose()
    action()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="editor-context-menu"
      style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
      onKeyDown={handleMenuKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {misspelledWord && (
        <>
          {dictionarySuggestions.length > 0 ? (
            dictionarySuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="menuitem"
                className="context-menu-item is-suggestion"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runAction(() => onReplaceMisspelling(suggestion))}
              >
                <span className="context-menu-item-label">{suggestion}</span>
              </button>
            ))
          ) : (
            <div className="context-menu-empty" role="presentation">
              {labels.noSuggestions}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            className="context-menu-item"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runAction(() => onAddToDictionary(misspelledWord))}
          >
            <span className="context-menu-item-label">
              {labels.addToDictionary(misspelledWord)}
            </span>
          </button>
          <div className="context-menu-separator" role="separator" />
        </>
      )}

      {canComment && (
        <>
          <button
            type="button"
            role="menuitem"
            className="context-menu-item is-accent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runAction(onComment)}
          >
            <span className="context-menu-item-main">
              <CommentAddIcon size={14} aria-hidden="true" />
              <span className="context-menu-item-label">{labels.comment}</span>
            </span>
            <kbd className="context-menu-shortcut">Ctrl+Alt+M</kbd>
          </button>
          <div className="context-menu-separator" role="separator" />
        </>
      )}

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={editFlags.canUndo === false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('undo'))}
      >
        <span className="context-menu-item-label">{labels.undo}</span>
        <kbd className="context-menu-shortcut">Ctrl+Z</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={editFlags.canRedo === false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('redo'))}
      >
        <span className="context-menu-item-label">{labels.redo}</span>
        <kbd className="context-menu-shortcut">Ctrl+Y</kbd>
      </button>
      <div className="context-menu-separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={!editFlags.canCut}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('cut'))}
      >
        <span className="context-menu-item-label">{labels.cut}</span>
        <kbd className="context-menu-shortcut">Ctrl+X</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={!editFlags.canCopy}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('copy'))}
      >
        <span className="context-menu-item-label">{labels.copy}</span>
        <kbd className="context-menu-shortcut">Ctrl+C</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={!editFlags.canPaste}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('paste'))}
      >
        <span className="context-menu-item-label">{labels.paste}</span>
        <kbd className="context-menu-shortcut">Ctrl+V</kbd>
      </button>
      <div className="context-menu-separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        disabled={editFlags.canSelectAll === false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runAction(() => onEditAction('selectAll'))}
      >
        <span className="context-menu-item-label">{labels.selectAll}</span>
        <kbd className="context-menu-shortcut">Ctrl+A</kbd>
      </button>
    </div>
  )
}
