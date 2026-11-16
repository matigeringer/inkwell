import { useCallback, useEffect, useState } from 'react'
import { CommentAddIcon } from './Icons'

export default function CommentSelectionBubble({
  editor,
  isSourceMode,
  sourceRef,
  stageRef,
  disabled,
  label,
  title,
  onComment
}) {
  const [position, setPosition] = useState(null)

  const updatePosition = useCallback(() => {
    if (disabled) {
      setPosition(null)
      return
    }
    const stage = stageRef?.current
    if (!stage) {
      setPosition(null)
      return
    }

    if (isSourceMode) {
      const textarea = sourceRef?.current
      if (
        !textarea ||
        document.activeElement !== textarea ||
        textarea.selectionStart === textarea.selectionEnd
      ) {
        setPosition(null)
        return
      }
      const stageRect = stage.getBoundingClientRect()
      const taRect = textarea.getBoundingClientRect()
      if (!stageRect.width || !taRect.width) {
        setPosition(null)
        return
      }
      setPosition({
        top: Math.max(8, taRect.top - stageRect.top + 8),
        left: Math.min(stageRect.width - 130, taRect.right - stageRect.left - 120)
      })
      return
    }

    if (!editor || editor.isDestroyed) {
      setPosition(null)
      return
    }
    const { selection } = editor.state
    if (selection.empty || !editor.isFocused) {
      setPosition(null)
      return
    }

    try {
      const coords = editor.view.coordsAtPos(selection.to)
      const stageRect = stage.getBoundingClientRect()
      if (!coords || (!coords.top && !coords.bottom && !coords.left)) {
        setPosition(null)
        return
      }
      const rawTop = coords.top - stageRect.top - 42
      const top = rawTop >= 8 ? rawTop : coords.bottom - stageRect.top + 8
      const left = Math.max(8, Math.min(stageRect.width - 132, coords.right - stageRect.left - 24))
      setPosition({ top, left })
    } catch {
      setPosition(null)
    }
  }, [disabled, editor, isSourceMode, sourceRef, stageRef])

  useEffect(() => {
    if (disabled) return
    const frame = requestAnimationFrame(updatePosition)

    if (isSourceMode) {
      const textarea = sourceRef?.current
      if (!textarea) return () => cancelAnimationFrame(frame)
      const events = ['mouseup', 'keyup', 'select', 'blur', 'scroll']
      events.forEach((evt) => textarea.addEventListener(evt, updatePosition))
      return () => {
        cancelAnimationFrame(frame)
        events.forEach((evt) => textarea.removeEventListener(evt, updatePosition))
      }
    }

    if (!editor || editor.isDestroyed) return () => cancelAnimationFrame(frame)
    editor.on('selectionUpdate', updatePosition)
    editor.on('focus', updatePosition)
    editor.on('blur', updatePosition)
    return () => {
      cancelAnimationFrame(frame)
      editor.off('selectionUpdate', updatePosition)
      editor.off('focus', updatePosition)
      editor.off('blur', updatePosition)
    }
  }, [disabled, editor, isSourceMode, sourceRef, updatePosition])

  if (disabled || !position) return null

  return (
    <button
      type="button"
      className="comment-selection-bubble"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onComment}
      title={title}
      aria-label={title}
    >
      <CommentAddIcon size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
