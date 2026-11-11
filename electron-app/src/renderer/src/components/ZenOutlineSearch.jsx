import { useEffect, useRef, useState } from 'react'
import DocumentOutline from './DocumentOutline'
import { OutlineIcon } from './Icons'

export default function ZenOutlineSearch({ labels, onOpen, ...options }) {
  const [open, setOpen] = useState(false)
  const controlRef = useRef(null)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event) => {
      if (!controlRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [open])

  const close = () => {
    setOpen(false)
    toggleRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      className="zen-outline-control"
      ref={controlRef}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          event.stopPropagation()
          close()
        }
      }}
    >
      <button
        type="button"
        ref={toggleRef}
        className={`zen-pill-btn zen-pill-icon-only ${open ? 'active' : ''}`}
        onClick={() => {
          if (!open) onOpen()
          setOpen(!open)
        }}
        title={labels.search}
        aria-label={labels.search}
        aria-expanded={open}
        aria-controls={open ? 'zen-outline-search' : undefined}
      >
        <OutlineIcon size={15} aria-hidden="true" />
      </button>
      {open && <DocumentOutline {...options} labels={labels} open onClose={close} searchOnly />}
    </div>
  )
}
