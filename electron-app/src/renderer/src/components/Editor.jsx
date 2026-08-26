import { useState, useEffect, useRef, useCallback } from 'react'

export default function Editor({ initialDoc, onBack }) {
  const [content, setContent] = useState(initialDoc?.content || '')
  const [filePath, setFilePath] = useState(initialDoc?.filePath || null)
  const [fileName, setFileName] = useState(initialDoc?.fileName || 'documento.md')
  const [saveStatus, setSaveStatus] = useState('unsaved') // 'unsaved' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const textareaRef = useRef(null)

  // Enfocar el área de texto al montar
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Manejar cambios en el texto
  const handleChange = (e) => {
    setContent(e.target.value)
    setSaveStatus('unsaved')
  }

  // Guardar archivo (normal o si es nuevo abre diálogo)
  const handleSave = useCallback(async () => {
    if (!window.api?.saveFile) {
      console.warn('API de Electron no disponible')
      return
    }

    try {
      setSaveStatus('saving')
      setErrorMessage('')

      const res = await window.api.saveFile({
        content,
        filePath,
        defaultName: fileName
      })

      if (res.canceled) {
        setSaveStatus(filePath ? 'saved' : 'unsaved')
        return
      }

      if (res.success) {
        setFilePath(res.filePath)
        setFileName(res.fileName)
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
        setErrorMessage(res.error || 'Error al guardar el archivo')
      }
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error inesperado al guardar')
    }
  }, [content, filePath, fileName])

  // Guardar como (siempre abre diálogo nativo)
  const handleSaveAs = useCallback(async () => {
    if (!window.api?.saveFileAs) return

    try {
      setSaveStatus('saving')
      setErrorMessage('')

      const res = await window.api.saveFileAs({
        content,
        defaultName: fileName
      })

      if (res.canceled) {
        setSaveStatus(filePath ? 'saved' : 'unsaved')
        return
      }

      if (res.success) {
        setFilePath(res.filePath)
        setFileName(res.fileName)
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
        setErrorMessage(res.error || 'Error al guardar el archivo')
      }
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error inesperado al guardar')
    }
  }, [content, fileName, filePath])

  // Atajos de teclado (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // Soporte de tecla Tab dentro del textarea
  const handleKeyDownTextarea = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Insertar 2 espacios para sangría
      const tabSpaces = '  '
      const newContent = content.substring(0, start) + tabSpaces + content.substring(end)
      setContent(newContent)
      setSaveStatus('unsaved')

      // Mover el cursor después de los espacios insertados
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length
      }, 0)
    }
  }

  // Cálculos estadísticos para escritores
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const characters = content.length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  return (
    <div className="editor-view">
      {/* Barra superior de herramientas y estado */}
      <header className="editor-header">
        <div className="header-left">
          <button className="btn-icon-text" onClick={onBack} title="Volver a la pantalla de inicio">
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Inicio</span>
          </button>

          <div className="file-info">
            <span className="file-name" title={filePath || fileName}>
              {fileName}
            </span>
            <div className={`status-badge status-${saveStatus}`}>
              <span className="status-dot" />
              <span className="status-label">
                {saveStatus === 'saved' && 'Guardado'}
                {saveStatus === 'unsaved' && 'Sin guardar'}
                {saveStatus === 'saving' && 'Guardando...'}
                {saveStatus === 'error' && 'Error'}
              </span>
            </div>
          </div>
        </div>

        <div className="header-right">
          {errorMessage && <span className="error-badge">{errorMessage}</span>}

          <button
            className="btn-secondary"
            onClick={handleSaveAs}
            title="Guardar como una nueva copia"
          >
            <span>Guardar como...</span>
          </button>

          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            title="Guardar archivo (Ctrl+S)"
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>Guardar</span>
            <kbd className="shortcut-hint">Ctrl+S</kbd>
          </button>
        </div>
      </header>

      {/* Lienzo de escritura centralizado */}
      <main className="editor-main">
        <div className="editor-canvas">
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDownTextarea}
            placeholder="# Empezá a escribir tu texto en Markdown acá..."
            spellCheck="true"
          />
        </div>
      </main>

      {/* Barra de estado discreta inferior */}
      <footer className="editor-footer">
        <div className="footer-stats">
          <span className="stat-item">
            <strong>{words}</strong> {words === 1 ? 'palabra' : 'palabras'}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <strong>{characters}</strong> caracteres
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <strong>~{readingTime}</strong>{' '}
            {readingTime === 1 ? 'min de lectura' : 'mins de lectura'}
          </span>
        </div>

        {filePath && (
          <div className="footer-path" title={filePath}>
            <span className="path-text">{filePath}</span>
          </div>
        )}
      </footer>
    </div>
  )
}
