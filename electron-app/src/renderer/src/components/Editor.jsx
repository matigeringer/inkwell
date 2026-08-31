import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import {
  ArrowLeftIcon,
  SaveIcon,
  SaveAsIcon,
  SettingsIcon,
  ZenFocusIcon,
  KeyboardIcon,
  BarChartIcon,
  CloseIcon,
  SidebarIcon
} from './Icons'
import FileTree from './FileTree'

const FONT_SIZES_SCALE = [
  '1.00rem',
  '1.10rem',
  '1.25rem',
  '1.40rem',
  '1.60rem',
  '1.80rem',
  '2.00rem',
  '2.40rem'
]

export default function Editor({
  initialDoc,
  onBack,
  preferences,
  onUpdatePreferences,
  onOpenProfile,
  openedFolder,
  onRefreshFolderTree,
  onCloseFolder,
  onOpenFolder
}) {
  const [filePath, setFilePath] = useState(initialDoc?.filePath || null)
  const [fileName, setFileName] = useState(initialDoc?.fileName || 'documento.md')
  const [saveStatus, setSaveStatus] = useState('unsaved') // 'unsaved' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [isZenMode, setIsZenMode] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(Boolean(openedFolder))
  const [showStatsHud, setShowStatsHud] = useState(false)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [isMouseActive, setIsMouseActive] = useState(false)
  const mouseTimerRef = useRef(null)
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)
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

  // Mostrar mensaje efímero discreto (Toast)
  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToast({ message, type, id: Date.now() })
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
    }, 2200)
  }, [])

  // Obtener contenido en formato Markdown
  const getMarkdownContent = useCallback(() => {
    if (!editor) return initialDoc?.content || ''
    return editor.storage.markdown.getMarkdown()
  }, [editor, initialDoc?.content])

  // Guardar archivo (normal o si es nuevo abre diálogo)
  const handleSave = useCallback(async () => {
    if (!window.api?.saveFile) {
      console.warn('API de Electron no disponible')
      showToast('Guardado simulado (modo navegador)', 'info')
      setSaveStatus('saved')
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
        showToast(`Guardado: ${res.fileName}`)
        if (onRefreshFolderTree) {
          onRefreshFolderTree()
        }
      } else {
        setSaveStatus('error')
        setErrorMessage(res.error || 'Error al guardar el archivo')
        showToast(res.error || 'Error al guardar', 'error')
      }
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error inesperado al guardar')
      showToast('Error inesperado al guardar', 'error')
    }
  }, [getMarkdownContent, filePath, fileName, onRefreshFolderTree, showToast])

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
        showToast(`Guardado como: ${res.fileName}`)
        if (onRefreshFolderTree) {
          onRefreshFolderTree()
        }
      } else {
        setSaveStatus('error')
        setErrorMessage(res.error || 'Error al guardar el archivo')
        showToast(res.error || 'Error al guardar', 'error')
      }
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err.message || 'Error inesperado al guardar')
      showToast('Error al guardar copia', 'error')
    }
  }, [getMarkdownContent, fileName, filePath, onRefreshFolderTree, showToast])

  // Cambiar de documento de forma fluida desde el explorador
  const handleSwitchDoc = useCallback(
    async (targetFilePath) => {
      if (targetFilePath === filePath) return

      // Si el documento actual tiene ruta y cambios sin guardar, auto-guardar
      if (saveStatus === 'unsaved' && filePath && window.api?.saveFile) {
        try {
          const markdownContent = getMarkdownContent()
          await window.api.saveFile({
            content: markdownContent,
            filePath,
            defaultName: fileName
          })
        } catch (err) {
          console.warn('No se pudo autoguardar antes de cambiar:', err)
        }
      }

      if (!window.api?.readFile) return
      try {
        const res = await window.api.readFile(targetFilePath)
        if (res && res.success) {
          setFilePath(res.filePath)
          setFileName(res.fileName)
          setSaveStatus('saved')
          if (editor) {
            editor.commands.setContent(res.content || '', false)
          }
          showToast(`Abierto: ${res.fileName}`)
        } else {
          showToast(res.error || 'Error al abrir archivo', 'error')
        }
      } catch (err) {
        showToast(err.message || 'Error al leer archivo', 'error')
      }
    },
    [filePath, fileName, saveStatus, editor, getMarkdownContent, showToast]
  )

  // Abrir archivo individual directamente con diálogo
  const handleOpenFileDirectly = useCallback(async () => {
    if (!window.api?.openFileDialog) return
    try {
      const res = await window.api.openFileDialog()
      if (res && res.success) {
        setFilePath(res.filePath)
        setFileName(res.fileName)
        setSaveStatus('saved')
        if (editor) {
          editor.commands.setContent(res.content || '', false)
        }
        showToast(`Abierto: ${res.fileName}`)
      }
    } catch (err) {
      showToast(err.message || 'Error al abrir archivo', 'error')
    }
  }, [editor, showToast])

  // Sincronizar y alternar Modo Zen con Pantalla Completa
  const toggleZenMode = useCallback(
    async (forcedState) => {
      const nextState = typeof forcedState === 'boolean' ? forcedState : !isZenMode
      setIsZenMode(nextState)

      // Controlar pantalla completa nativa en Electron o fallback al navegador
      try {
        if (window.api?.setFullScreen) {
          await window.api.setFullScreen(nextState)
        } else if (nextState && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {})
        } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {})
        }
      } catch (err) {
        console.warn('No se pudo alternar pantalla completa:', err)
      }

      if (nextState) {
        showToast('Modo Zen activado • F11 o Esc para salir')
      } else {
        showToast('Modo Zen desactivado')
        setShowStatsHud(false)
        setIsShortcutsModalOpen(false)
      }
    },
    [isZenMode, showToast]
  )

  // Escuchar cambios externos de pantalla completa (gestos del SO o tecla F11 nativa)
  useEffect(() => {
    let cleanupIpc = null
    if (window.api?.onFullScreenChange) {
      cleanupIpc = window.api.onFullScreenChange((isFullscreen) => {
        setIsZenMode(isFullscreen)
      })
    }

    const handleDomFullscreenChange = () => {
      if (!window.api?.onFullScreenChange) {
        setIsZenMode(Boolean(document.fullscreenElement))
      }
    }

    document.addEventListener('fullscreenchange', handleDomFullscreenChange)

    return () => {
      if (cleanupIpc) cleanupIpc()
      document.removeEventListener('fullscreenchange', handleDomFullscreenChange)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  // Alternar Tema (Claro / Oscuro)
  const cycleTheme = useCallback(() => {
    if (!onUpdatePreferences) return
    const currentTheme = preferences?.theme || 'light'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    onUpdatePreferences({ theme: nextTheme })
    showToast(`Tema: ${nextTheme === 'dark' ? 'Obsidian (Oscuro)' : 'Parchment (Claro)'}`)
  }, [preferences?.theme, onUpdatePreferences, showToast])

  // Alternar Familia Tipográfica (Serif -> Sans -> Mono)
  const cycleFontFamily = useCallback(() => {
    if (!onUpdatePreferences) return
    const currentFont = preferences?.fontFamily || 'serif'
    let nextFont = 'serif'
    let fontName = 'Newsreader (Serif)'

    if (currentFont === 'serif') {
      nextFont = 'sans'
      fontName = 'Plus Jakarta (Sans)'
    } else if (currentFont === 'sans') {
      nextFont = 'mono'
      fontName = 'JetBrains (Mono)'
    } else {
      nextFont = 'serif'
      fontName = 'Newsreader (Serif)'
    }

    onUpdatePreferences({ fontFamily: nextFont })
    showToast(`Tipografía: ${fontName}`)
  }, [preferences?.fontFamily, onUpdatePreferences, showToast])

  // Ajustar tamaño de fuente (+ / - / Reset)
  const adjustFontSize = useCallback(
    (delta) => {
      if (!onUpdatePreferences) return
      const current = preferences?.fontSize || '1.40rem'
      const currentIndex = FONT_SIZES_SCALE.indexOf(current)

      let nextSize = current
      if (currentIndex !== -1) {
        const nextIndex = Math.max(0, Math.min(FONT_SIZES_SCALE.length - 1, currentIndex + delta))
        nextSize = FONT_SIZES_SCALE[nextIndex]
      } else {
        nextSize = delta > 0 ? '1.60rem' : '1.25rem'
      }

      onUpdatePreferences({ fontSize: nextSize })
      showToast(`Tamaño de fuente: ${nextSize}`)
    },
    [preferences?.fontSize, onUpdatePreferences, showToast]
  )

  const resetFontSize = useCallback(() => {
    if (!onUpdatePreferences) return
    onUpdatePreferences({ fontSize: '1.40rem' })
    showToast('Tamaño estándar (1.40rem)')
  }, [onUpdatePreferences, showToast])

  // Controlar visibilidad del toolbar flotante al mover el ratón en Modo Zen
  const handleMouseMove = useCallback(() => {
    if (!isZenMode) return
    setIsMouseActive(true)
    if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current)
    mouseTimerRef.current = setTimeout(() => {
      setIsMouseActive(false)
    }, 2400)
  }, [isZenMode])

  // Atajos de teclado globales del editor
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ocultar inmediatamente la barra flotante al escribir
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current)
      setIsMouseActive(false)

      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // 1. F11: Alternar Modo Zen / Pantalla Completa
      if (e.key === 'F11') {
        e.preventDefault()
        toggleZenMode()
        return
      }

      // 2. Ctrl+Shift+F: Alternar Modo Zen
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        toggleZenMode()
        return
      }

      // 3. Escape: Cerrar modales o salir de Modo Zen
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault()
          setIsShortcutsModalOpen(false)
          return
        }
        if (showStatsHud) {
          e.preventDefault()
          setShowStatsHud(false)
          return
        }
        if (isZenMode) {
          e.preventDefault()
          toggleZenMode(false)
          return
        }
      }

      // 4. F1 o Ctrl+/: Ayuda de atajos Zen
      if (e.key === 'F1' || (isCtrlOrMeta && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsModalOpen((prev) => !prev)
        return
      }

      // 5. Ctrl+S: Guardar
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSave()
        return
      }

      // 6. Ctrl+Shift+S: Guardar como
      if (isCtrlOrMeta && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSaveAs()
        return
      }

      // 7. Ctrl+O: Abrir archivo
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        handleOpenFileDirectly()
        return
      }

      // 8. Ctrl+Shift+O: Abrir carpeta
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        if (onOpenFolder) onOpenFolder()
        return
      }

      // 9. Ctrl+\ o Ctrl+B: Alternar barra lateral / explorador
      if (
        (isCtrlOrMeta && e.key === '\\') ||
        (isCtrlOrMeta && !e.shiftKey && (e.key === 'b' || e.key === 'B'))
      ) {
        if (!isZenMode && openedFolder) {
          e.preventDefault()
          setIsSidebarOpen((prev) => !prev)
          return
        }
      }

      // 10. Ctrl+Shift+T: Alternar Tema
      if (isCtrlOrMeta && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        cycleTheme()
        return
      }

      // 11. Ctrl+Shift+L: Alternar Tipografía
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        cycleFontFamily()
        return
      }

      // 12. Ctrl+Shift+C: Mostrar / Ocultar estadísticas HUD
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setShowStatsHud((prev) => !prev)
        return
      }

      // 13. Ctrl+= / Ctrl++: Aumentar tamaño de fuente
      if (isCtrlOrMeta && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        adjustFontSize(1)
        return
      }

      // 14. Ctrl+-: Disminuir tamaño de fuente
      if (isCtrlOrMeta && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        adjustFontSize(-1)
        return
      }

      // 15. Ctrl+0: Restablecer tamaño de fuente
      if (isCtrlOrMeta && e.key === '0') {
        e.preventDefault()
        resetFontSize()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current)
    }
  }, [
    isZenMode,
    isShortcutsModalOpen,
    showStatsHud,
    openedFolder,
    toggleZenMode,
    handleSave,
    handleSaveAs,
    handleOpenFileDirectly,
    onOpenFolder,
    cycleTheme,
    cycleFontFamily,
    adjustFontSize,
    resetFontSize
  ])

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
  const paragraphs = plainText.split(/\n+/).filter((p) => p.trim().length > 0).length

  return (
    <div
      className={`editor-view ${isZenMode ? 'zen-mode-active' : ''}`}
      onMouseMove={handleMouseMove}
    >
      {/* Barra superior de herramientas y estado (se oculta totalmente en Zen) */}
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

          {openedFolder && (
            <button
              className={`btn-icon-sober ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title={
                isSidebarOpen
                  ? 'Ocultar explorador de archivos (Ctrl+\\ o Ctrl+B)'
                  : 'Mostrar explorador de archivos (Ctrl+\\ o Ctrl+B)'
              }
              aria-label="Alternar explorador de archivos"
            >
              <SidebarIcon size={16} />
            </button>
          )}

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
            onClick={() => toggleZenMode()}
            title="Modo Zen a Pantalla Completa (F11 o Ctrl+Shift+F)"
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
            title="Guardar como una nueva copia (Ctrl+Shift+S)"
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

      {/* Controles flotantes discretos en Modo Zen (visibles únicamente al mover el ratón) */}
      {isZenMode && (
        <aside
          className={`zen-floating-toolbar ${isMouseActive ? 'visible' : ''}`}
          aria-label="Controles discretos de modo Zen"
        >
          <div className="zen-toolbar-pill">
            <button
              className="zen-pill-btn zen-pill-icon-only"
              onClick={() => setShowStatsHud((prev) => !prev)}
              title="Ver estadísticas (Ctrl+Shift+C)"
              aria-label="Ver estadísticas"
            >
              <BarChartIcon size={15} />
            </button>
            <button
              className="zen-pill-btn zen-pill-icon-only"
              onClick={() => setIsShortcutsModalOpen(true)}
              title="Guía de atajos de teclado (F1 o Ctrl+/)"
              aria-label="Guía de atajos"
            >
              <KeyboardIcon size={15} />
            </button>
            <div className="zen-pill-divider" />
            <button
              className="zen-pill-btn zen-pill-exit"
              onClick={() => toggleZenMode(false)}
              title="Salir de Modo Zen (Esc o F11)"
            >
              <span>Salir</span>
              <kbd className="zen-kbd-hint">Esc</kbd>
            </button>
          </div>
        </aside>
      )}

      {/* Notificación flotante efímera (Toast) */}
      {toast && (
        <div className={`zen-toast zen-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="zen-toast-text">{toast.message}</span>
        </div>
      )}

      {/* HUD de Estadísticas Flotante (Ctrl+Shift+C) */}
      {showStatsHud && (
        <div className="zen-stats-overlay" onClick={() => setShowStatsHud(false)}>
          <div
            className="zen-stats-card"
            onClick={(e) => e.stopPropagation()}
            role="region"
            aria-label="Estadísticas de escritura"
          >
            <div className="zen-stats-header">
              <div className="zen-stats-title-row">
                <BarChartIcon size={16} />
                <h3 className="zen-stats-title">Estadísticas del Manuscrito</h3>
              </div>
              <button
                className="btn-icon-subtle"
                onClick={() => setShowStatsHud(false)}
                title="Cerrar (Esc)"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="zen-stats-grid">
              <div className="zen-stat-box">
                <span className="zen-stat-num">{words}</span>
                <span className="zen-stat-name">{words === 1 ? 'Palabra' : 'Palabras'}</span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">{characters}</span>
                <span className="zen-stat-name">Caracteres</span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">~{readingTime}</span>
                <span className="zen-stat-name">
                  {readingTime === 1 ? 'Minuto de lectura' : 'Minutos de lectura'}
                </span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">{paragraphs}</span>
                <span className="zen-stat-name">{paragraphs === 1 ? 'Párrafo' : 'Párrafos'}</span>
              </div>
            </div>
            {filePath && (
              <div className="zen-stats-footer">
                <span className="zen-stats-path" title={filePath}>
                  {filePath}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Guía de Atajos de Teclado Zen (F1 o Ctrl+/) */}
      {isShortcutsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsShortcutsModalOpen(false)}>
          <div
            className="modal-card zen-shortcuts-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="shortcuts-title"
          >
            <header className="modal-header">
              <div className="modal-title-group">
                <div className="modal-avatar-badge">
                  <KeyboardIcon size={18} />
                </div>
                <div>
                  <h2 id="shortcuts-title" className="modal-title">
                    Atajos de Teclado
                  </h2>
                  <p className="modal-subtitle">
                    Controla Fountain y el explorador sin usar el ratón
                  </p>
                </div>
              </div>
              <button
                className="btn-icon-subtle"
                onClick={() => setIsShortcutsModalOpen(false)}
                title="Cerrar (Esc)"
              >
                <CloseIcon size={18} />
              </button>
            </header>

            <div className="modal-body zen-shortcuts-body">
              {/* Sección Archivos y Espacio de Trabajo */}
              <section className="shortcuts-section">
                <h4 className="shortcuts-section-title">Archivos y Espacio de Trabajo</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Guardar documento</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>S</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Guardar copia como...</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Abrir archivo Markdown</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>O</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Abrir carpeta de trabajo</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Alternar barra del explorador</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>\</kbd>
                      <span className="shortcut-or">o</span>
                      <kbd>Ctrl</kbd>+<kbd>B</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Ver esta ayuda de atajos</span>
                    <div className="shortcut-keys">
                      <kbd>F1</kbd>
                      <span className="shortcut-or">o</span>
                      <kbd>Ctrl</kbd>+<kbd>/</kbd>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección Modo Zen */}
              <section className="shortcuts-section">
                <h4 className="shortcuts-section-title">Modo Zen y Pantalla Completa</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Activar / Alternar Modo Zen</span>
                    <div className="shortcut-keys">
                      <kbd>F11</kbd>
                      <span className="shortcut-or">o</span>
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Salir del Modo Zen</span>
                    <div className="shortcut-keys">
                      <kbd>Esc</kbd>
                      <span className="shortcut-or">o</span>
                      <kbd>F11</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Mostrar / Ocultar estadísticas</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección Tipografía y Apariencia */}
              <section className="shortcuts-section">
                <h4 className="shortcuts-section-title">Tipografía y Apariencia</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Alternar Tema (Claro / Oscuro)</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Alternar Tipografía (Serif / Sans / Mono)</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Aumentar tamaño de texto</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>+</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Reducir tamaño de texto</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>-</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Restablecer tamaño estándar</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>0</kbd>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección Markdown Rápido */}
              <section className="shortcuts-section">
                <h4 className="shortcuts-section-title">Formato de Texto</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Negrita / Cursiva</span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>Ctrl</kbd>+<kbd>I</kbd>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Títulos (H1, H2, H3)</span>
                    <div className="shortcut-keys">
                      <span className="markdown-hint"># , ## , ### al inicio</span>
                    </div>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-desc">Citas y Bloques</span>
                    <div className="shortcut-keys">
                      <span className="markdown-hint">&gt; al inicio</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <footer className="modal-footer">
              <button className="btn-done" onClick={() => setIsShortcutsModalOpen(false)}>
                Entendido
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Disposición dividida para panel lateral y lienzo */}
      <div className="editor-workspace-layout">
        {openedFolder && isSidebarOpen && !isZenMode && (
          <aside className="editor-sidebar-panel">
            <FileTree
              openedFolder={openedFolder}
              activeFilePath={filePath}
              onSelectFile={handleSwitchDoc}
              onRefreshTree={onRefreshFolderTree}
              onCloseFolder={onCloseFolder}
              showToast={showToast}
            />
          </aside>
        )}

        {/* Lienzo de escritura WYSIWYG centralizado */}
        <main className="editor-main" onClick={handleCanvasClick}>
          <div className="editor-canvas" onClick={handleCanvasClick}>
            <EditorContent editor={editor} className="tiptap-wrapper" />
          </div>
        </main>
      </div>

      {/* Barra de estado discreta inferior (se oculta totalmente en Zen) */}
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
