import { useEffect, useRef } from 'react'

export default function useModalFocus(isOpen) {
  const ref = useRef(null)
  useEffect(() => {
    if (!isOpen || !ref.current) return
    const dialog = ref.current
    const previous = document.activeElement
    const selector =
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
    const focusable = () =>
      [...dialog.querySelectorAll(selector)].filter((node) => !node.closest('[hidden]'))
    ;(focusable()[0] || dialog).focus()
    const trap = (event) => {
      if (event.key !== 'Tab') return
      const dialogs = [...document.querySelectorAll('[aria-modal="true"]')]
      if (dialogs.at(-1) !== dialog) return
      const items = focusable()
      const first = items[0] || dialog
      const last = items.at(-1) || dialog
      if (
        !dialog.contains(document.activeElement) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    }
    document.addEventListener('keydown', trap, true)
    return () => {
      document.removeEventListener('keydown', trap, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [isOpen])
  return ref
}
