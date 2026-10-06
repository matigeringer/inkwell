import { useState, useEffect } from 'react'
import { CloseIcon, HistoryIcon, TrashIcon, CopyIcon, CheckIcon, ArrowLeftIcon } from './Icons'
import { getTranslation } from '../i18n'

export default function HistoryModal({
  isOpen,
  onClose,
  docKey,
  docName,
  currentContent = '',
  onRestoreVersion,
  preferences,
  showToast
}) {
  const [snapshots, setSnapshots] = useState([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  const currentLang = preferences?.language || 'es'
  const t = getTranslation(currentLang)

  // Cargar snapshots del documento al abrir
  useEffect(() => {
    if (!isOpen || !docKey || !window.api?.historyGetSnapshots) {
      return
    }

    let isMounted = true

    window.api
      .historyGetSnapshots(docKey)
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && Array.isArray(res.snapshots)) {
          setSnapshots(res.snapshots)
          if (res.snapshots.length > 0) {
            setSelectedSnapshotId((prev) => {
              const exists = res.snapshots.some((s) => s.id === prev)
              return exists ? prev : res.snapshots[0].id
            })
          } else {
            setSelectedSnapshotId(null)
            setPreviewContent('')
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error al cargar snapshots:', err)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, docKey])

  // Cargar contenido de la snapshot seleccionada
  useEffect(() => {
    if (!isOpen || !docKey || !selectedSnapshotId || !window.api?.historyGetSnapshotContent) {
      return
    }

    let isMounted = true
    window.api
      .historyGetSnapshotContent({ docKey, snapshotId: selectedSnapshotId })
      .then((res) => {
        if (isMounted && res && res.success) {
          setPreviewContent(res.content || '')
        }
      })
      .catch((err) => {
        console.error('Error al cargar contenido de la snapshot:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, docKey, selectedSnapshotId])

  // Manejar tecla Escape y navegación con flechas
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (snapshots.length === 0) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = snapshots.findIndex((s) => s.id === selectedSnapshotId)
        if (currentIndex === -1) return

        if (e.key === 'ArrowDown' && currentIndex < snapshots.length - 1) {
          setSelectedSnapshotId(snapshots[currentIndex + 1].id)
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          setSelectedSnapshotId(snapshots[currentIndex - 1].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, snapshots, selectedSnapshotId])

  if (!isOpen) return null

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || null

  // Formato de fecha relativo / absoluto
  const formatSnapshotDate = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSeconds < 60) {
      return currentLang === 'en' ? 'Just now' : 'Hace un momento'
    }
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) {
      return currentLang === 'en'
        ? `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`
        : `Hace ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`
    }

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    const timeStr = date.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })

    if (isToday) {
      return currentLang === 'en' ? `Today at ${timeStr}` : `Hoy a las ${timeStr}`
    }

    const dateStr = date.toLocaleDateString(currentLang === 'en' ? 'en-US' : 'es-ES', {
      day: 'numeric',
      month: 'short'
    })

    return `${dateStr}, ${timeStr}`
  }

  // Eliminar una snapshot específica
  const handleDeleteSnapshot = async (e, snapshotId) => {
    e.stopPropagation()
    if (!window.api?.historyDeleteSnapshot || !docKey) return

    try {
      const res = await window.api.historyDeleteSnapshot({ docKey, snapshotId })
      if (res && res.success) {
        setSnapshots((prev) => {
          const next = prev.filter((s) => s.id !== snapshotId)
          if (selectedSnapshotId === snapshotId) {
            setSelectedSnapshotId(next.length > 0 ? next[0].id : null)
          }
          return next
        })
        if (showToast) {
          showToast(
            t.history?.toastDeleted ||
              (currentLang === 'en' ? 'Version deleted' : 'Versión eliminada')
          )
        }
      }
    } catch (err) {
      console.error('Error al eliminar snapshot:', err)
    }
  }

  // Copiar contenido de la versión al portapapeles
  const handleCopyContent = async () => {
    if (!previewContent) return
    try {
      await navigator.clipboard.writeText(previewContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      if (showToast) {
        showToast(
          t.history?.toastCopied ||
            (currentLang === 'en' ? 'Version content copied' : 'Contenido copiado al portapapeles')
        )
      }
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err)
    }
  }

  // Restaurar la versión seleccionada
  const handleRestore = () => {
    if (!selectedSnapshot) return
    if (onRestoreVersion) {
      onRestoreVersion(previewContent, selectedSnapshot)
      onClose()
    }
  }

  // Cálculo de diferencia de palabras
  const currentWords = currentContent.trim()
    ? currentContent.trim().split(/\s+/).filter(Boolean).length
    : 0
  const snapshotWords = selectedSnapshot?.words || 0
  const deltaWords = snapshotWords - currentWords

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-wide history-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <header className="modal-header-wide history-modal-header">
          <div className="history-modal-header-left">
            <div className="history-header-icon-box">
              <HistoryIcon size={19} />
            </div>
            <div>
              <h2 id="history-modal-title" className="modal-title">
                {t.history?.title ||
                  (currentLang === 'en' ? 'Version History' : 'Historial de Versiones')}
              </h2>
              <p className="modal-subtitle">
                {docName || t.common.appName} •{' '}
                {snapshots.length === 1
                  ? t.history?.singleVersion ||
                    (currentLang === 'en' ? '1 version saved' : '1 versión guardada')
                  : t.history?.countVersions?.(snapshots.length) ||
                    (currentLang === 'en'
                      ? `${snapshots.length} versions saved`
                      : `${snapshots.length} versiones guardadas`)}
              </p>
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

        <div className="history-modal-body">
          {/* Panel Izquierdo: Lista de Instantáneas Temporales */}
          <aside className="history-timeline-panel">
            <div className="history-timeline-header">
              <span className="label-caps">
                {t.history?.timelineLabel || (currentLang === 'en' ? 'Timeline' : 'Línea Temporal')}
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div className="history-empty-state">
                <p>
                  {t.history?.emptyMessage ||
                    (currentLang === 'en'
                      ? 'No previous versions recorded yet. Snapshots will appear here as you write.'
                      : 'Aún no hay versiones anteriores registradas. Las instantáneas se guardarán automáticamente a medida que escribas.')}
                </p>
              </div>
            ) : (
              <div className="history-snapshot-list">
                {snapshots.map((item, index) => {
                  const isSelected = item.id === selectedSnapshotId
                  const isFirst = index === 0
                  return (
                    <div
                      key={item.id}
                      className={`history-snapshot-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedSnapshotId(item.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="snapshot-item-indicator">
                        <span className={`snapshot-dot ${isFirst ? 'is-latest' : ''}`} />
                        {index < snapshots.length - 1 && <span className="snapshot-connector" />}
                      </div>

                      <div className="snapshot-item-content">
                        <div className="snapshot-item-row">
                          <span className="snapshot-item-time">
                            {formatSnapshotDate(item.timestamp)}
                          </span>
                          <span
                            className={`snapshot-trigger-pill ${item.trigger === 'manual' ? 'pill-manual' : 'pill-auto'}`}
                          >
                            {item.trigger === 'manual'
                              ? t.history?.triggerManual ||
                                (currentLang === 'en' ? 'Manual' : 'Manual')
                              : t.history?.triggerAuto || (currentLang === 'en' ? 'Auto' : 'Auto')}
                          </span>
                        </div>

                        <div className="snapshot-item-meta">
                          <span>
                            {item.words}{' '}
                            {item.words === 1
                              ? t.stats?.wordSingular || (currentLang === 'en' ? 'word' : 'palabra')
                              : t.stats?.words || (currentLang === 'en' ? 'words' : 'palabras')}
                          </span>
                          <span className="snapshot-meta-dot">•</span>
                          <span>
                            {item.characters}{' '}
                            {t.stats?.characters || (currentLang === 'en' ? 'chars' : 'caracteres')}
                          </span>
                        </div>

                        {item.preview && <p className="snapshot-item-preview">{item.preview}</p>}
                      </div>

                      <button
                        className="btn-snapshot-delete"
                        onClick={(e) => handleDeleteSnapshot(e, item.id)}
                        title={
                          t.common.delete ||
                          (currentLang === 'en' ? 'Delete snapshot' : 'Eliminar versión')
                        }
                        aria-label={t.common.delete}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </aside>

          {/* Panel Derecho: Vista Previa y Acciones */}
          <main className="history-preview-panel">
            {selectedSnapshot ? (
              <>
                <div className="history-preview-header">
                  <div className="history-preview-meta">
                    <span className="history-preview-date">
                      {formatSnapshotDate(selectedSnapshot.timestamp)}
                    </span>
                    <div className="history-preview-stats">
                      <span>
                        <strong>{selectedSnapshot.words}</strong>{' '}
                        {selectedSnapshot.words === 1
                          ? t.stats?.wordSingular || 'palabra'
                          : t.stats?.words || 'palabras'}
                      </span>
                      <span className="stat-separator">•</span>
                      <span>
                        <strong>{selectedSnapshot.characters}</strong>{' '}
                        {t.stats?.characters || 'caracteres'}
                      </span>
                      {deltaWords !== 0 && (
                        <>
                          <span className="stat-separator">•</span>
                          <span
                            className={`snapshot-delta-pill ${deltaWords > 0 ? 'delta-positive' : 'delta-negative'}`}
                          >
                            {deltaWords > 0 ? `+${deltaWords}` : deltaWords}{' '}
                            {t.history?.wordsDiff ||
                              (currentLang === 'en' ? 'words vs current' : 'palabras vs actual')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="history-preview-actions">
                    <button
                      className="btn-sober-secondary btn-history-action"
                      onClick={handleCopyContent}
                      title={
                        t.history?.copyTitle ||
                        (currentLang === 'en' ? 'Copy text' : 'Copiar texto')
                      }
                    >
                      {isCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      <span>
                        {isCopied
                          ? t.history?.copied || (currentLang === 'en' ? 'Copied' : 'Copiado')
                          : t.history?.copy || (currentLang === 'en' ? 'Copy' : 'Copiar')}
                      </span>
                    </button>

                    <button
                      className="btn-sober-primary btn-history-action"
                      onClick={handleRestore}
                      title={
                        t.history?.restoreTitle ||
                        (currentLang === 'en'
                          ? 'Restore this version to the editor'
                          : 'Cargar esta versión en el editor')
                      }
                    >
                      <ArrowLeftIcon size={14} />
                      <span>
                        {t.history?.restore ||
                          (currentLang === 'en' ? 'Restore version' : 'Restaurar versión')}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="history-preview-surface">
                  <div
                    className="history-preview-text"
                    style={{
                      fontFamily:
                        preferences?.fontFamily === 'sans'
                          ? 'var(--font-ui)'
                          : preferences?.fontFamily === 'mono'
                            ? 'var(--font-mono)'
                            : 'var(--font-serif)',
                      fontSize: preferences?.fontSize || '1.40rem',
                      textAlign: preferences?.textAlign || 'left'
                    }}
                  >
                    {previewContent ? (
                      previewContent
                    ) : (
                      <span className="history-empty-text">
                        {t.history?.emptyDocument ||
                          (currentLang === 'en' ? '(Empty document)' : '(Documento vacío)')}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="history-no-selection">
                <HistoryIcon size={32} className="history-no-sel-icon" />
                <p>
                  {snapshots.length > 0
                    ? t.history?.selectVersionPrompt ||
                      (currentLang === 'en'
                        ? 'Select a version from the timeline to view its contents.'
                        : 'Selecciona una versión de la línea temporal para ver su contenido.')
                    : t.history?.noVersionsPrompt ||
                      (currentLang === 'en'
                        ? 'No versions recorded yet for this document.'
                        : 'No hay versiones registradas aún para este documento.')}
                </p>
              </div>
            )}
          </main>
        </div>

        <footer className="modal-footer-wide history-modal-footer">
          <span className="history-footer-hint">
            {t.history?.shortcutHint ||
              (currentLang === 'en'
                ? 'Tip: You can open this history anytime with Ctrl+H'
                : 'Consejo: Puedes abrir este historial en cualquier momento con Ctrl+H')}
          </span>
          <button className="btn-done" onClick={onClose}>
            {t.common.done}
          </button>
        </footer>
      </div>
    </div>
  )
}
