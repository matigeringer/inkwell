import { useEffect } from 'react'
import { CloseIcon, TrashIcon } from './Icons'

export default function DeleteConfirmModal({ isOpen, item, onConfirm, onClose }) {
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
  const title = isDir ? 'Eliminar carpeta' : 'Eliminar archivo'
  const description = isDir
    ? `¿Estás seguro de que deseas eliminar la carpeta "${item.name}" y todo su contenido?`
    : `¿Estás seguro de que deseas eliminar el archivo "${item.name}"?`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card delete-modal-card"
        onClick={(e) => e.stopPropagation()}
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
              <p className="modal-subtitle">Se enviará a la papelera de reciclaje</p>
            </div>
          </div>

          <button
            className="btn-icon-subtle"
            onClick={onClose}
            aria-label="Cerrar modal"
            title="Cerrar (Esc)"
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
            Cancelar
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
            <span>Eliminar</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
