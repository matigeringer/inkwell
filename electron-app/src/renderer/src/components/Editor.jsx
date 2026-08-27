import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { ArrowLeftIcon, SaveIcon, SaveAsIcon, SettingsIcon, ZenFocusIcon } from './Icons'

export default function Editor({ initialDoc, onBack, onOpenProfile }) {
  const [filePath, setFilePath] = useState(initialDoc?.filePath || null)
  const [fileName, setFileName] = useState(initialDoc?.fileName || 'documento.md')
  const [saveStatus, setSaveStatus] = useState('unsaved') // 'unsaved' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [isZenMode, setIsZenMode] = useState(false)
  const [, setTick] = useState(0) // Forzar re-render en cambios para estadísticas

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6]
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'fountain-code-block'
          }
        },
        bulletList: {
          HTMLAttributes: {
            class: 'fountain-bullet-list'
          }
        },
        orderedList: {
          HTMLAttributes: {
            class: 'fountain-ordered-list'
          }
        },
        blockquote: {
          HTMLAttributes: {
            class: 'fountain-blockquote'
          }
        },
        horizontalRule: {
          HTMLAttributes: {
            class: 'fountain-hr'
          }
        }
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true
      }),
      Placeholder.configure({
        placeholder:
          'Empezá a escribir tu manuscrito o usá Markdown (# Título, *cursiva*, **negrita**, > cita)...'
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'fountain-task-list'
        }
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'fountain-task-item'
        }
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'fountain-link'
        }
      })
    ],
    content: initialDoc?.content || '',
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'fountain-editor-content'
      }
    },
    onUpdate: () => {
      setSaveStatus('unsaved')
      setTick((t) => t + 1)
    }
  })

  // Obtener contenido en formato Markdown
  const getMarkdownContent = useCallback(() => {
    if (!editor) return initialDoc?.content || ''
    return editor.storage.markdown.getMarkdown()
  }, [editor, initialDoc?.content])

  // Guardar archivo (normal o si es nuevo abre diálogo)
  const handleSave = useCallback(async () => {
    if (!window.api?.saveFile) {
      console.warn('API de Electron no disponible')
      return
    }

    try {
      setSaveStatus('saving')
      setErrorMessage('')

      const markdownContent = getMarkdownContent()

      const res = await window.api.saveFile({
        content: markdownContent,
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
  }, [getMarkdownContent, filePath, fileName])

  // Guardar como (siempre abre diálogo nativo)
  const handleSaveAs = useCallback(async () => {
    if (!window.api?.saveFileAs) return

    try {
      setSaveStatus('saving')
      setErrorMessage('')

      const markdownContent = getMarkdownContent()

      const res = await window.api.saveFileAs({
        content: markdownContent,
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
  }, [getMarkdownContent, fileName, filePath])

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

  // Enfocar al hacer click en el lienzo fuera del texto
  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget && editor) {
      editor.commands.focus('end')
    }
  }

  // Cálculos estadísticos para escritores
  const plainText = editor ? editor.getText() : ''
  const words = plainText.trim() ? plainText.trim().split(/\s+/).filter(Boolean).length : 0
  const characters = plainText.length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  return (
    <div className={`editor-view ${isZenMode ? 'zen-mode-active' : ''}`}>
      {/* Barra superior de herramientas y estado */}
      <header className="editor-header">
        <div className="header-left">
          <button
            className="btn-header-back"
            onClick={onBack}
            title="Volver a la pantalla de inicio"
            aria-label="Volver a inicio"
          >
            <ArrowLeftIcon size={17} />
            <span>Inicio</span>
          </button>

          <div className="doc-meta-header">
            <span className="doc-title-text" title={filePath || fileName}>
              {fileName}
            </span>
            <span className="doc-meta-separator">•</span>
            <div className={`doc-status status-${saveStatus}`}>
              <span className="doc-status-dot" />
              <span className="doc-status-label">
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
            className={`btn-icon-sober ${isZenMode ? 'active' : ''}`}
            onClick={() => setIsZenMode(!isZenMode)}
            title={isZenMode ? 'Salir del modo concentración' : 'Modo concentración (Zen)'}
            aria-label="Modo concentración"
          >
            <ZenFocusIcon size={16} />
          </button>

          {onOpenProfile && (
            <button
              className="btn-icon-sober"
              onClick={onOpenProfile}
              title="Preferencias de lectura y tipografía"
              aria-label="Preferencias"
            >
              <SettingsIcon size={16} />
            </button>
          )}

          <div className="header-divider" />

          <button
            className="btn-sober-secondary"
            onClick={handleSaveAs}
            title="Guardar como una nueva copia"
          >
            <SaveAsIcon size={15} />
            <span>Guardar como</span>
          </button>

          <button
            className="btn-sober-primary"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            title="Guardar archivo (Ctrl+S)"
          >
            <SaveIcon size={15} />
            <span>Guardar</span>
            <kbd className="shortcut-hint">Ctrl+S</kbd>
          </button>
        </div>
      </header>

      {/* Lienzo de escritura WYSIWYG centralizado */}
      <main className="editor-main" onClick={handleCanvasClick}>
        <div className="editor-canvas" onClick={handleCanvasClick}>
          <EditorContent editor={editor} className="tiptap-wrapper" />
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
