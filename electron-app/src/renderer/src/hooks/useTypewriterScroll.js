import { useCallback, useEffect, useRef } from 'react'

export default function useTypewriterScroll(containerRef, { enabled, position, behavior }) {
  const settings = useRef({ enabled, position, behavior })
  const manualScroll = useRef(false)
  const mouseDown = useRef(false)
  const anchoredLine = useRef(null)
  const measureFrame = useRef(null)
  const animationFrame = useRef(null)
  const clickTimer = useRef(null)

  const stopAnimation = useCallback(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    animationFrame.current = null
  }, [])

  const cancelScroll = useCallback(() => {
    stopAnimation()
    if (measureFrame.current !== null) cancelAnimationFrame(measureFrame.current)
    measureFrame.current = null
    clearTimeout(clickTimer.current)
  }, [stopAnimation])

  useEffect(() => {
    settings.current = { enabled, position, behavior }
    if (!enabled) {
      cancelScroll()
      manualScroll.current = false
      anchoredLine.current = null
    }
  }, [enabled, position, behavior, cancelScroll])

  const animateScroll = useCallback(
    (container, delta, duration) => {
      stopAnimation()
      const start = container.scrollTop
      const maximum = Math.max(0, container.scrollHeight - container.clientHeight)
      const target = Math.max(0, Math.min(start + delta, maximum))
      if (Math.abs(target - start) < 1) {
        container.scrollTop = target
        return
      }

      let startedAt
      const step = (now) => {
        startedAt ??= now
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        container.scrollTop = start + (target - start) * eased
        animationFrame.current = progress < 1 ? requestAnimationFrame(step) : null
      }
      animationFrame.current = requestAnimationFrame(step)
    },
    [stopAnimation]
  )

  const centerCaret = useCallback(
    (editor, { reason = 'focus', duration = 110, force = false } = {}) => {
      const canScroll = () =>
        settings.current.enabled &&
        !editor?.isDestroyed &&
        editor?.state.selection?.empty &&
        !mouseDown.current &&
        (!manualScroll.current || force)
      if (!canScroll()) return

      if (measureFrame.current !== null) cancelAnimationFrame(measureFrame.current)
      measureFrame.current = requestAnimationFrame(() => {
        measureFrame.current = null
        const container = containerRef.current
        if (!container || !canScroll()) return

        let coords
        try {
          coords = editor.view.coordsAtPos(editor.state.selection.head)
        } catch {
          // The editor view can be detached while switching between rich text and source.
          return
        }
        const { top, height } = container.getBoundingClientRect()
        const anchor = top + height * (settings.current.position === 'eye' ? 0.38 : 0.5)
        const caret = (coords.top + coords.bottom) / 2
        const lineHeight = Math.max(16, coords.bottom - coords.top)
        const lineInDocument = caret - top + container.scrollTop
        if (
          reason === 'typing' &&
          anchoredLine.current !== null &&
          Math.abs(lineInDocument - anchoredLine.current) < lineHeight * 0.45
        ) {
          return
        }

        anchoredLine.current = lineInDocument
        const delta = caret - anchor
        if (reason === 'navigation' && settings.current.behavior === 'deadzone') {
          // Move just enough to keep the caret inside the tolerance band.
          const tolerance = Math.max(lineHeight * 2, height * 0.14)
          if (Math.abs(delta) > tolerance) {
            animateScroll(container, delta - Math.sign(delta) * tolerance, duration)
          }
        } else {
          animateScroll(container, delta, duration)
        }
      })
    },
    [animateScroll, containerRef]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const pauseForManualScroll = () => {
      if (!settings.current.enabled) return
      cancelScroll()
      manualScroll.current = true
    }
    const onScrollbarClick = (event) => {
      if (event.clientX >= container.getBoundingClientRect().left + container.clientWidth) {
        pauseForManualScroll()
      }
    }
    const releaseMouse = () => {
      mouseDown.current = false
    }
    container.addEventListener('wheel', pauseForManualScroll, { passive: true })
    container.addEventListener('mousedown', onScrollbarClick)
    window.addEventListener('mouseup', releaseMouse)
    return () => {
      container.removeEventListener('wheel', pauseForManualScroll)
      container.removeEventListener('mousedown', onScrollbarClick)
      window.removeEventListener('mouseup', releaseMouse)
      cancelScroll()
    }
  }, [cancelScroll, containerRef])

  return {
    cancelScroll,
    centerCaret,
    onKeyDown(_view, event) {
      if (!settings.current.enabled) return false
      const primary = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const extendsSelection =
        event.shiftKey &&
        (key.startsWith('arrow') || ['home', 'end', 'pageup', 'pagedown'].includes(key))
      if (!extendsSelection && (!primary || key === 'v' || key === 'x')) {
        manualScroll.current = false
      }
      return false
    },
    onMouseDown() {
      mouseDown.current = true
      cancelScroll()
      return false
    },
    onMouseUp(editor) {
      mouseDown.current = false
      if (settings.current.enabled && editor) {
        clearTimeout(clickTimer.current)
        clickTimer.current = setTimeout(() => {
          if (editor.isDestroyed || !editor.state.selection?.empty) return
          manualScroll.current = false
          centerCaret(editor, { duration: 160, force: true })
        }, 30)
      }
      return false
    },
    onSelectionUpdate({ editor, transaction }) {
      if (!transaction?.docChanged) centerCaret(editor, { reason: 'navigation' })
    },
    onDocumentUpdate(editor) {
      manualScroll.current = false
      centerCaret(editor, { reason: 'typing', force: true })
    },
    onFocus({ editor }) {
      centerCaret(editor, { duration: 120, force: true })
    }
  }
}
