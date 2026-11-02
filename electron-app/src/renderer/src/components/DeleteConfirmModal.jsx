import useModalFocus from '../hooks/useModalFocus'
import { useEffect } from 'react'
import { CloseIcon, TrashIcon } from './Icons'
import { getTranslation } from '../i18n'

export default function DeleteConfirmModal({ isOpen, item, onConfirm, onClose, language = 'es' }) {
  const dialogRef = useModalFocus(isOpen)
  const t = getTranslation(language)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !item) return null

  const isDir = item.isDirectory
  const title = isDir ? t.deleteModal.titleFolder : t.deleteModal.titleFile
  const description = isDir
    ? t.deleteModal.descFolder(item.name)
    : t.deleteModal.descFile(item.name)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card delete-modal-card"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <header className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 id="delete-modal-title" className="modal-title">
                {title}
              </h2>
              <p className="modal-subtitle">{t.deleteModal.subtitle}</p>
            </div>
          </div>

          <button
            className="btn-icon-subtle"
            onClick={onClose}
            aria-label={t.common.close}
            title={`${t.common.close} (Esc)`}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="modal-body delete-modal-body">
          <p className="delete-confirm-text">{description}</p>
          <div className="delete-item-pill">
            <span className="delete-item-path" title={item.path}>
              {item.path}
            </span>
          </div>
        </div>

        <footer className="modal-footer delete-modal-footer">
          <button type="button" className="btn-sober-secondary" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn-danger-action"
            onClick={() => {
              onConfirm(item)
              onClose()
            }}
          >
            <TrashIcon size={15} />
            <span>{t.common.delete}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
