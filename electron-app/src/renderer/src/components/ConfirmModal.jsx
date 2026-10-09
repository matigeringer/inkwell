import { useEffect } from 'react'
import { CloseIcon } from './Icons'

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'warning', // 'warning' | 'danger'
  onConfirm,
  onClose
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop modal-backdrop-elevated"
      onClick={onClose}
      style={{ zIndex: 120 }}
    >
      <div
        className="modal-card confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <header className="confirm-modal-header">
          <h2 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon-subtle"
            onClick={onClose}
            aria-label={cancelLabel}
            title={`${cancelLabel} (Esc)`}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
        </div>

        <footer className="confirm-modal-footer">
          <button type="button" className="confirm-btn confirm-btn-cancel" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-btn ${variant === 'danger' ? 'confirm-btn-danger' : 'confirm-btn-primary'}`}
            onClick={() => {
              onConfirm?.()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
