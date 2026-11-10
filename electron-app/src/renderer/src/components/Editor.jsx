import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  ArrowLeftIcon,
  SaveIcon,
  SaveAsIcon,
  SettingsIcon,
  ZenFocusIcon,
  KeyboardIcon,
  CloseIcon,
  SidebarIcon,
  TypewriterIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon,
  ExportIcon,
  FilePdfIcon,
  FileDocxIcon,
  FileOdtIcon,
  FileMarkdownIcon,
  FileTextIcon,
  ChevronDownIcon,
  HistoryIcon,
  MenuIcon,
  FeatherIcon,
  FolderTreeIcon,
  FolderIcon,
  SearchIcon
} from './Icons'
import FileTree from './FileTree'
import HistoryModal from './HistoryModal'
import ManuscriptSearch from './ManuscriptSearch'
import SourceEditor from './SourceEditor'
import ZenFloatingFolder from './ZenFloatingFolder'
import { getTranslation } from '../i18n'
import useDocumentPersistence from '../hooks/useDocumentPersistence'
import useManuscriptSearch from '../hooks/useManuscriptSearch'
import { saveDraft } from '../lib/drafts'
import { needsSourceEditor } from '../lib/markdownSupport'
import { revealMatch, SearchHighlights } from '../lib/manuscriptSearch'

const EXPORT_OPTIONS = [
  {
    key: 'pdf',
    ext: '.pdf',
    icon: FilePdfIcon,
    nameKey: 'pdfName',
    descKey: 'pdfDesc',
    badgeKey: 'pdfBadge'
  },
  {
    key: 'docx',
    ext: '.docx',
    icon: FileDocxIcon,
    nameKey: 'docxName',
    descKey: 'docxDesc',
    badgeKey: 'docxBadge'
  },
  {
    key: 'odt',
    ext: '.odt',
    icon: FileOdtIcon,
    nameKey: 'odtName',
    descKey: 'odtDesc',
    badgeKey: 'odtBadge'
  },
  {
    key: 'markdown',
    ext: '.md',
    icon: FileMarkdownIcon,
    nameKey: 'markdownName',
    descKey: 'markdownDesc',
    badgeKey: 'markdownBadge'
  },
  {
    key: 'txt',
    ext: '.txt',
    icon: FileTextIcon,
    nameKey: 'txtName',
    descKey: 'txtNameDesc',
    badgeKey: 'txtNameBadge'
  }
]

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
  onSelectFile,
  onBack,
  preferences,
  onUpdatePreferences,
  onOpenProfile,
  openedFolder,
  openedFolders = [],
  looseFiles = [],
  onSavedFile,
  onSwitchFolder,
  onRefreshFolderTree,
  onCloseFolder,
  onOpenFolder,
  onNewDoc,
  onItemRenamed,
  onItemDeleted
}) {
  const currentLang = preferences?.language || 'es'
  const t = getTranslation(currentLang)
  const defaultDocName = currentLang === 'en' ? 'document.md' : 'documento.md'

  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)
  const showToast = useCallback((message, type = 'info') => {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, type, id: Date.now() })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimeoutRef.current), [])
  const persistedCallbackRef = useRef(null)
  const onPersist = useCallback((result) => persistedCallbackRef.current?.(result), [])
  const {
    session,
    filePath,
    fileName,
    saveStatus,
    errorMessage,
    saveBeforeSwitch,
    handleSave,
    handleSaveAs,
    cancelAutoSave
  } = useDocumentPersistence({
    initialDoc: { ...initialDoc, fileName: initialDoc?.fileName || defaultDocName },
    preferences,
    onSavedFile,
    onPersist,
    showToast
  })
  const [isSourceMode, setIsSourceMode] = useState(
    () => needsSourceEditor(initialDoc?.content) || /\.txt$/i.test(initialDoc?.fileName || '')
  )
  const transitionRef = useRef(false)
  const [isZenMode, setIsZenMode] = useState(false)
  const [sidebarHiddenFor, setSidebarHiddenFor] = useState(null)
  const isSidebarOpen = Boolean(openedFolder) && sidebarHiddenFor !== openedFolder.path
  const setIsSidebarOpen = useCallback(
    (value) => {
      const next = typeof value === 'function' ? value(isSidebarOpen) : value
      setSidebarHiddenFor(next ? null : openedFolder?.path)
    },
    [isSidebarOpen, openedFolder?.path]
  )
  const [isManuscriptDropdownOpen, setIsManuscriptDropdownOpen] = useState(false)

  const [showStatsHud, setShowStatsHud] = useState(false)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [shortcutsTab, setShortcutsTab] = useState('zen')
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const lastSnapshotTimeRef = useRef(0)
  const lastSnapshotWordsRef = useRef(0)
  const [isMouseActive, setIsMouseActive] = useState(false)
  const mouseTimerRef = useRef(null)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const actionsMenuRef = useRef(null)
  const exportDropdownRef = useRef(null)
  const manuscriptDropdownRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const typewriterModeRef = useRef(Boolean(preferences?.typewriterMode))
  const typewriterPositionRef = useRef(preferences?.typewriterPosition || 'center')
  const typewriterBehaviorRef = useRef(preferences?.typewriterBehavior || 'deadzone')
  const isUserManualScrollingRef = useRef(false)
  const scrollAnimationRef = useRef({ rafId: null })
  const lastAnchoredLineYRef = useRef(null)
  const isMouseDownRef = useRef(false)
  const [, setTick] = useState(0) // Forzar re-render en cambios para estadísticas

  // Cerrar menú de acciones, exportación o desplegable de manuscritos al hacer clic afuera o presionar Escape
  useEffect(() => {
    if (!actionsMenuOpen && !exportMenuOpen && !isManuscriptDropdownOpen) return

    const handleClickOutside = (e) => {
      if (
        isManuscriptDropdownOpen &&
        manuscriptDropdownRef.current &&
        !manuscriptDropdownRef.current.contains(e.target)
      ) {
        setIsManuscriptDropdownOpen(false)
      }
      if (
        exportMenuOpen &&
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(e.target)
      ) {
        setExportMenuOpen(false)
      }
      if (actionsMenuOpen && actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setActionsMenuOpen(false)
        setExportMenuOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isManuscriptDropdownOpen) {
          setIsManuscriptDropdownOpen(false)
        } else if (exportMenuOpen) {
          setExportMenuOpen(false)
        } else if (actionsMenuOpen) {
          setActionsMenuOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [actionsMenuOpen, exportMenuOpen, isManuscriptDropdownOpen])

  // Sincronizar refs de modo máquina de escribir
  useEffect(() => {
    typewriterModeRef.current = Boolean(preferences?.typewriterMode)
    typewriterPositionRef.current = preferences?.typewriterPosition || 'center'
    typewriterBehaviorRef.current = preferences?.typewriterBehavior || 'deadzone'
    if (!preferences?.typewriterMode) {
      if (scrollAnimationRef.current.rafId) {
        cancelAnimationFrame(scrollAnimationRef.current.rafId)
        scrollAnimationRef.current.rafId = null
      }
      isUserManualScrollingRef.current = false
      lastAnchoredLineYRef.current = null
    }
  }, [
    preferences?.typewriterMode,
    preferences?.typewriterPosition,
    preferences?.typewriterBehavior
  ])

  // Rastrear liberación global del ratón para finalizar estados de selección o arrastre
  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Cancelar animación de desplazamiento en curso
  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimationRef.current.rafId) {
      cancelAnimationFrame(scrollAnimationRef.current.rafId)
      scrollAnimationRef.current.rafId = null
    }
  }, [])

  // Motor de micro-desplazamiento con interpolación suave (easing rápido easeOutCubic de 80-130ms)
  const smoothScrollTo = useCallback(
    (targetScroll, duration = 110) => {
      const container = scrollContainerRef.current
      if (!container) return

      cancelScrollAnimation()

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
      const clampedTarget = Math.max(0, Math.min(targetScroll, maxScroll))
      const startScroll = container.scrollTop
      const distance = clampedTarget - startScroll

      if (Math.abs(distance) < 1) {
        container.scrollTop = clampedTarget
        return
      }

      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
      const startTime = performance.now()

      const step = (currentTime) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = easeOutCubic(progress)

        container.scrollTop = startScroll + distance * eased

        if (progress < 1) {
          scrollAnimationRef.current.rafId = requestAnimationFrame(step)
        } else {
          container.scrollTop = clampedTarget
          scrollAnimationRef.current.rafId = null
        }
      }

      scrollAnimationRef.current.rafId = requestAnimationFrame(step)
    },
    [cancelScrollAnimation]
  )

  // Centrado vertical ergonómico estilo Typewriter (50% medio o 38% línea de ojos)
  const centerCursor = useCallback(
    (targetEditor, options = {}) => {
      const {
        reason = 'type', // 'type' | 'nav' | 'click' | 'force'
        duration = 110,
        force = false
      } = options

      const container = scrollContainerRef.current
      if (!container) return
      if (!targetEditor?.view || !targetEditor?.state) return
      if (!typewriterModeRef.current) return

      // Si el usuario desacopló manualmente (rueda, scrollbar), respetar inspección hasta que escriba o edite
      if (isUserManualScrollingRef.current && !force) return

      const { selection } = targetEditor.state
      if (!selection) return

      // Selección de texto en bloque: mientras se selecciona texto o se arrastra el ratón, pausar el desplazamiento
      if (!selection.empty || isMouseDownRef.current) {
        return
      }

      requestAnimationFrame(() => {
        try {
          if (!scrollContainerRef.current || !targetEditor?.view) return
          if (isUserManualScrollingRef.current && !force) return
          const currentSel = targetEditor.state.selection
          if (!currentSel || !currentSel.empty || isMouseDownRef.current) return

          const caretPos = currentSel.head ?? currentSel.from
          const coords = targetEditor.view.coordsAtPos(caretPos)
          if (!coords) return

          const containerRect = container.getBoundingClientRect()
          // Ratio de ancla vertical: 50% centrado exacto o 38% tercio superior / línea de ojos
          const currentPosition = typewriterPositionRef.current
          const TARGET_RATIO = currentPosition === 'eye' ? 0.38 : 0.5
          const targetY = containerRect.top + containerRect.height * TARGET_RATIO
          const cursorY = (coords.top + coords.bottom) / 2
          const lineHeight = Math.max(16, coords.bottom - coords.top)
          const lineCenterInDoc = cursorY - containerRect.top + container.scrollTop

          const isSamePhysicalLine =
            lastAnchoredLineYRef.current !== null &&
            Math.abs(lineCenterInDoc - lastAnchoredLineYRef.current) < lineHeight * 0.45

          const delta = cursorY - targetY

          // 1. Escritura continua en la misma línea: mantener la pantalla 100% fija (sin ningún temblor ni salto)
          if (reason === 'type') {
            if (isSamePhysicalLine) {
              return
            }
            // Si el cursor saltó a un nuevo renglón (Enter, word-wrap hacia adelante o backspace línea anterior), centrarlo suavemente
            lastAnchoredLineYRef.current = lineCenterInDoc
            const targetScroll = container.scrollTop + delta
            smoothScrollTo(targetScroll, duration)
            return
          }

          const currentBehavior = typewriterBehaviorRef.current

          // 2. Navegación con flechas en Zona de Tolerancia (Deadzone)
          if (reason === 'nav' && currentBehavior === 'deadzone') {
            const deadzoneTolerance = Math.max(lineHeight * 2, containerRect.height * 0.14)
            const deadzoneTop = targetY - deadzoneTolerance
            const deadzoneBottom = targetY + deadzoneTolerance

            // Si el cursor está dentro de la zona de tolerancia, permitir mover libremente sin mover la pantalla
            if (cursorY >= deadzoneTop && cursorY <= deadzoneBottom) {
              lastAnchoredLineYRef.current = lineCenterInDoc
              return
            }

            // Si salió de la zona, acompañarlo suavemente
            let targetScroll = container.scrollTop
            if (cursorY < deadzoneTop) {
              targetScroll += cursorY - deadzoneTop
            } else if (cursorY > deadzoneBottom) {
              targetScroll += cursorY - deadzoneBottom
            }

            lastAnchoredLineYRef.current = lineCenterInDoc
            smoothScrollTo(targetScroll, duration)
            return
          }

          // 3. Clics ('click'), navegación estricta ('nav' strict) o re-centrado forzado ('force'):
          lastAnchoredLineYRef.current = lineCenterInDoc
          const targetScroll = container.scrollTop + delta
          smoothScrollTo(targetScroll, duration)
        } catch {
          // Silenciar errores durante transiciones o renders rápidos
        }
      })
    },
    [smoothScrollTo]
  )

  // Coexistencia con scroll manual: desacople limpio con rueda o arrastre directo de la barra de scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleWheel = () => {
      if (!typewriterModeRef.current) return
      cancelScrollAnimation()
      isUserManualScrollingRef.current = true
    }

    const handleMouseDown = (e) => {
      if (!typewriterModeRef.current) return
      // Detectar si el clic es sobre la barra de desplazamiento vertical en el borde derecho
      if (e.clientX >= container.getBoundingClientRect().left + container.clientWidth) {
        cancelScrollAnimation()
        isUserManualScrollingRef.current = true
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: true })
    container.addEventListener('mousedown', handleMouseDown)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      cancelScrollAnimation()
    }
  }, [cancelScrollAnimation])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, HTMLAttributes: { class: 'fountain-link' } },
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
        placeholder: () => t.editor.placeholder
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
      SearchHighlights
    ],
    content: session.state.content,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'fountain-editor-content',
        spellcheck: preferences?.spellcheckEnabled !== false ? 'true' : 'false',
        lang: currentLang === 'en' ? 'en' : 'es'
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (!typewriterModeRef.current || !editor) return false

          const isShift = event.shiftKey
          const isCtrlOrMeta = event.ctrlKey || event.metaKey

          // Selección en bloque: si el usuario está expandiendo selección con Shift o seleccionando todo (Ctrl+A), pausar typewriter
          if (
            isShift &&
            (event.key.startsWith('Arrow') ||
              event.key === 'Home' ||
              event.key === 'End' ||
              event.key === 'PageUp' ||
              event.key === 'PageDown')
          ) {
            return false
          }
          if (isCtrlOrMeta && (event.key === 'a' || event.key === 'A')) {
            return false
          }

          if (
            !isCtrlOrMeta ||
            event.key === 'v' ||
            event.key === 'V' ||
            event.key === 'x' ||
            event.key === 'X'
          ) {
            // Tecla de escritura/edición: reacoplar inmediatamente si el usuario había hecho scroll manual
            if (isUserManualScrollingRef.current) {
              isUserManualScrollingRef.current = false
            }
          }

          return false
        },
        mousedown: () => {
          isMouseDownRef.current = true
          return false
        },
        mouseup: () => {
          isMouseDownRef.current = false
          if (typewriterModeRef.current && editor) {
            setTimeout(() => {
              if (editor.state.selection?.empty) {
                // Reacoplar al hacer clic para posicionar el cursor y escribir
                isUserManualScrollingRef.current = false
                centerCursor(editor, { reason: 'click', duration: 160, force: true })
              }
            }, 30)
          }
          return false
        }
      }
    },
    onSelectionUpdate: ({ editor: ed, transaction }) => {
      if (typewriterModeRef.current) {
        if (!ed.state.selection?.empty || isMouseDownRef.current) {
          return
        }
        // Si la transacción modificó el documento (escritura, enter, borrado), onUpdate se encarga
        if (transaction?.docChanged) {
          return
        }
        centerCursor(ed, { reason: 'nav', duration: 110, force: false })
      }
    },
    onUpdate: ({ editor: ed }) => {
      if (isSourceMode) return
      session.change(ed.storage.markdown.getMarkdown())
      setTick((t) => t + 1)

      if (typewriterModeRef.current) {
        // Reacople automático y desplazamiento suave en la línea activa al escribir o dar saltos de línea (Enter / word-wrap)
        isUserManualScrollingRef.current = false
        centerCursor(ed, { reason: 'type', duration: 110, force: true })
      }
    },
    onFocus: ({ editor: ed }) => {
      if (typewriterModeRef.current) {
        centerCursor(ed, { reason: 'force', duration: 120, force: true })
      }
    }
  })

  const revealSearchMatch = useCallback(
    (match) => {
      const container = scrollContainerRef.current
      if (!container) return
      cancelScrollAnimation()
      revealMatch(container, match)
    },
    [cancelScrollAnimation]
  )
  // Textareas normalize line endings, so highlight offsets use the same text as the input.
  const source = isSourceMode ? session.state.content.replace(/\r\n?/g, '\n') : null
  const search = useManuscriptSearch({ editor, source, onReveal: revealSearchMatch })
  const { isOpen: isSearchOpen, open: openSearch, close: closeSearch } = search

  // Centrar al cambiar preferencias si está activo
  useEffect(() => {
    if (preferences?.typewriterMode && editor) {
      const timer = setTimeout(() => {
        centerCursor(editor, { reason: 'force', duration: 130, force: true })
      }, 80)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [
    preferences?.typewriterMode,
    preferences?.typewriterPosition,
    preferences?.typewriterBehavior,
    editor,
    centerCursor
  ])

  // Re-centrar en cambios de tamaño de ventana si Typewriter está activo
  useEffect(() => {
    const handleResize = () => {
      if (typewriterModeRef.current && editor) {
        centerCursor(editor, { reason: 'force', duration: 100, force: true })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [editor, centerCursor])

  // Sincronizar dinámicamente atributos de corrector ortográfico e idioma en el editor
  useEffect(() => {
    if (editor?.view?.dom) {
      editor.view.dom.setAttribute(
        'spellcheck',
        preferences?.spellcheckEnabled !== false ? 'true' : 'false'
      )
      editor.view.dom.setAttribute('lang', preferences?.language === 'en' ? 'en' : 'es')
    }
  }, [editor, preferences?.spellcheckEnabled, preferences?.language])

  // Obtener contenido en formato Markdown
  const getMarkdownContent = useCallback(() => {
    if (isSourceMode || !editor) return session.state.content
    return editor.storage.markdown.getMarkdown()
  }, [editor, session, isSourceMode])

  // Guardar instantánea en el historial temporal
  const saveHistorySnapshot = useCallback(
    async ({ trigger = 'auto', forcedContent = null, customFilePath = null } = {}) => {
      if (!window.api?.historySaveSnapshot || preferences?.historyEnabled === false) {
        return { success: true }
      }

      const content = forcedContent !== null ? forcedContent : getMarkdownContent()
      const wordsCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0
      const charsCount = content.length

      // Si es auto, verificar intervalo de tiempo o delta sustancial de palabras
      if (trigger === 'auto') {
        const interval = preferences?.historySnapshotInterval || 120000
        const timeSinceLast = Date.now() - lastSnapshotTimeRef.current
        const wordsDiff = Math.abs(wordsCount - lastSnapshotWordsRef.current)

        if (timeSinceLast < interval && wordsDiff < 25) {
          return
        }
      }

      const targetPath = customFilePath !== null ? customFilePath : filePath
      const currentDocKey = targetPath || (initialDoc?.id ? `draft_${initialDoc.id}` : 'temp_doc')

      try {
        const res = await window.api.historySaveSnapshot({
          docKey: currentDocKey,
          docName: fileName,
          filePath: targetPath,
          content,
          trigger,
          words: wordsCount,
          characters: charsCount,
          maxEntries: preferences?.historyMaxEntries || 50
        })

        if (res && res.success && !res.duplicate) {
          lastSnapshotTimeRef.current = Date.now()
          lastSnapshotWordsRef.current = wordsCount
        }
        if (!res?.success) throw new Error(res?.error || 'No se pudo guardar el historial')
        return res
      } catch (err) {
        showToast(err.message, 'error')
        throw err
      }
    },
    [
      filePath,
      fileName,
      initialDoc?.id,
      getMarkdownContent,
      preferences?.historyEnabled,
      preferences?.historySnapshotInterval,
      preferences?.historyMaxEntries,
      showToast
    ]
  )

  useEffect(() => {
    persistedCallbackRef.current = async ({
      content,
      filePath: targetPath,
      previousPath,
      trigger
    }) => {
      const fromKey = previousPath || `draft_${initialDoc.id}`
      if (targetPath && fromKey !== targetPath && window.api?.historyMove) {
        const moved = await window.api.historyMove({
          fromKey,
          toKey: targetPath,
          docName: fileName,
          filePath: targetPath
        })
        if (!moved?.success) showToast(moved?.error || 'No se pudo trasladar el historial', 'error')
      }
      await saveHistorySnapshot({ trigger, forcedContent: content, customFilePath: targetPath })
    }
  }, [fileName, initialDoc.id, saveHistorySnapshot, showToast])

  const runTransition = useCallback(
    async (action) => {
      if (transitionRef.current) return false
      transitionRef.current = true
      editor?.setEditable(false, false)
      try {
        if (!(await saveBeforeSwitch())) return false
        return await action()
      } catch (error) {
        showToast(error.message, 'error')
        return false
      } finally {
        transitionRef.current = false
        if (editor && !editor.isDestroyed) editor.setEditable(true, false)
      }
    },
    [editor, saveBeforeSwitch, showToast]
  )

  const handleRestoreVersion = useCallback(
    async (restoredContent, snapshot) => {
      if (transitionRef.current) return false
      transitionRef.current = true
      editor?.setEditable(false, false)
      cancelAutoSave()
      try {
        await session.pending
        await saveHistorySnapshot({ trigger: 'manual', forcedContent: session.state.content })
        setIsSourceMode(
          needsSourceEditor(restoredContent) || /\.txt$/i.test(session.state.fileName)
        )
        editor?.commands.setContent(restoredContent, { emitUpdate: false })
        session.change(restoredContent)
        if (preferences.autoSaveEnabled !== false) await session.flush()
        showToast(
          `${currentLang === 'en' ? 'Version restored' : 'Versión restaurada'} (${new Date(snapshot.timestamp).toLocaleTimeString()})`
        )
        return true
      } catch (error) {
        showToast(error.message, 'error')
        return false
      } finally {
        transitionRef.current = false
        if (editor && !editor.isDestroyed) editor.setEditable(true, false)
      }
    },
    [
      editor,
      session,
      cancelAutoSave,
      saveHistorySnapshot,
      preferences.autoSaveEnabled,
      showToast,
      currentLang
    ]
  )

  const handleItemRenamed = useCallback(
    async (result) => {
      const current = session.state.filePath
      if (
        current &&
        (current === result.oldPath ||
          current.startsWith(result.oldPath + '/') ||
          current.startsWith(result.oldPath + '\\'))
      ) {
        const next = result.newPath + current.slice(result.oldPath.length)
        const name = next.split(/[\\/]/).pop()
        session.relocate(next, name)
        onSavedFile?.(next, name, session.state.content)
      }
      await onItemRenamed?.(result)
    },
    [session, onSavedFile, onItemRenamed]
  )

  const handleItemDeleted = useCallback(
    async (result) => {
      const current = session.state.filePath
      if (
        current &&
        (current === result.targetPath ||
          current.startsWith(result.targetPath + '/') ||
          current.startsWith(result.targetPath + '\\'))
      ) {
        saveDraft(session.state)
        session.relocate(null, session.state.fileName)
        onSavedFile?.(null, session.state.fileName, session.state.content)
        const moved = await window.api?.historyMove?.({
          fromKey: current,
          toKey: `draft_${initialDoc.id}`,
          docName: session.state.fileName,
          filePath: null
        })
        if (moved && !moved.success) showToast(moved.error, 'error')
      }
      await onItemDeleted?.(result)
    },
    [session, initialDoc.id, onSavedFile, onItemDeleted, showToast]
  )

  // Exportar documento en el formato seleccionado (PDF, Word, LibreOffice, Markdown, Texto plano)
  const handleExport = useCallback(
    async (format = 'pdf') => {
      if (!window.api?.exportDocument) return

      setExportMenuOpen(false)
      setIsExporting(true)

      const formatLabelMap = {
        pdf: 'PDF',
        docx: 'Word (.docx)',
        odt: 'OpenDocument (.odt)',
        markdown: 'Markdown (.md)',
        txt: 'Texto (.txt)'
      }
      const label = formatLabelMap[format] || format.toUpperCase()

      try {
        showToast(
          t.editor.exportingFormat?.(label) ||
            (currentLang === 'en' ? `Generating ${label} file...` : `Generando archivo ${label}...`)
        )
        const markdownContent = getMarkdownContent()
        const htmlContent = editor ? editor.getHTML() : null

        const res = await window.api.exportDocument({
          format,
          filePath,
          fileName,
          content: markdownContent,
          htmlContent
        })

        if (res?.canceled) {
          return
        }

        if (res?.success) {
          if (res.warnings?.length) {
            showToast(res.warnings.join(' · '))
            return
          }
          showToast(
            t.editor.toastExported?.(res.fileName || label) ||
              (currentLang === 'en'
                ? `Exported successfully: ${res.fileName || label}`
                : `Documento exportado: ${res.fileName || label}`)
          )
        } else {
          showToast(
            res?.error ||
              t.editor.toastExportError ||
              (currentLang === 'en' ? 'Error exporting document' : 'Error al exportar documento'),
            'error'
          )
        }
      } catch (err) {
        showToast(
          err.message ||
            (currentLang === 'en'
              ? 'Unexpected error exporting document'
              : 'Error inesperado al exportar documento'),
          'error'
        )
      } finally {
        setIsExporting(false)
      }
    },
    [filePath, fileName, editor, getMarkdownContent, showToast, currentLang, t]
  )

  const handleSelectFolderFromDropdown = useCallback(
    (targetFolderPath) =>
      runTransition(async () => {
        setIsManuscriptDropdownOpen(false)
        setSidebarHiddenFor(null)
        return onSwitchFolder?.(targetFolderPath)
      }),
    [runTransition, onSwitchFolder]
  )

  const handleOpenFolderFromDropdown = useCallback(
    () =>
      runTransition(async () => {
        setIsManuscriptDropdownOpen(false)
        const folder = await onOpenFolder?.()
        if (folder) {
          setSidebarHiddenFor(null)
          return onSwitchFolder?.(folder.path, folder)
        }
      }),
    [runTransition, onOpenFolder, onSwitchFolder]
  )

  const handleBack = useCallback(() => runTransition(() => onBack?.()), [runTransition, onBack])
  const handleNewDocument = useCallback(
    () => runTransition(() => onNewDoc?.()),
    [runTransition, onNewDoc]
  )
  const handleSwitchDoc = useCallback(
    (path, folderPath = openedFolder?.path) => {
      if (path === session.state.filePath) return
      return runTransition(() => onSelectFile?.(path, folderPath))
    },
    [session, openedFolder?.path, runTransition, onSelectFile]
  )
  const handleOpenFileDirectly = useCallback(
    () =>
      runTransition(async () => {
        const result = await window.api?.openFileDialog?.()
        if (result?.success) return onSelectFile?.(result.filePath)
        if (result && !result.canceled) throw new Error(result.error)
      }),
    [runTransition, onSelectFile]
  )

  useEffect(() => {
    return window.api?.onRequestClose?.(() => runTransition(() => true))
  }, [runTransition])

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
        const isPureZen =
          preferences?.zenShowToolbar === false &&
          preferences?.zenShowStats === false &&
          preferences?.zenShowFolder === false
        showToast(
          isPureZen
            ? t.editor.toastZenClean ||
                'Modo Zen activado (Pantalla limpia) • Pulsa Esc o F11 para salir'
            : t.editor.toastZenEnabled
        )
      } else {
        showToast(t.editor.toastZenDisabled)
        setShowStatsHud(false)
        setIsShortcutsModalOpen(false)
      }
    },
    [isZenMode, preferences, showToast, t]
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

  // Alternar Modo (Claro / Oscuro) dentro del tema activo sin cambiar de tema
  const cycleTheme = useCallback(() => {
    if (!onUpdatePreferences) return
    const isSystemDark =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
    const currentEffectiveMode =
      preferences?.mode === 'system'
        ? isSystemDark
          ? 'dark'
          : 'light'
        : preferences?.mode || 'light'
    const nextMode = currentEffectiveMode === 'dark' ? 'light' : 'dark'
    onUpdatePreferences({ mode: nextMode })
    const modeName =
      nextMode === 'dark'
        ? currentLang === 'en'
          ? 'Dark'
          : 'Oscuro'
        : currentLang === 'en'
          ? 'Light'
          : 'Claro'
    showToast(currentLang === 'en' ? `${modeName} Mode` : `Modo ${modeName}`)
  }, [preferences?.mode, onUpdatePreferences, showToast, currentLang])

  // Alternar Familia Tipográfica (Serif -> Sans -> Mono)
  const cycleFontFamily = useCallback(() => {
    if (!onUpdatePreferences) return
    const currentFont = preferences?.fontFamily || 'serif'
    let nextFont = 'serif'
    let fontName = 'Newsreader (Serif)'

    if (currentFont === 'serif') {
      nextFont = 'sans'
      fontName = 'Schibsted Grotesk (Sans)'
    } else if (currentFont === 'sans') {
      nextFont = 'mono'
      fontName = 'IBM Plex (Mono)'
    } else {
      nextFont = 'serif'
      fontName = 'Newsreader (Serif)'
    }

    onUpdatePreferences({ fontFamily: nextFont })
    showToast(currentLang === 'en' ? `Typeface: ${fontName}` : `Tipografía: ${fontName}`)
  }, [preferences?.fontFamily, onUpdatePreferences, showToast, currentLang])

  // Alternar Modo Máquina de Escribir (Typewriter Scrolling)
  const toggleTypewriterMode = useCallback(() => {
    if (!onUpdatePreferences) return
    const nextState = !preferences?.typewriterMode
    onUpdatePreferences({ typewriterMode: nextState })
    showToast(
      currentLang === 'en'
        ? `Typewriter Mode: ${nextState ? 'Active (Centered line)' : 'Disabled'}`
        : `Modo Máquina de Escribir: ${nextState ? 'Activado (Línea centrada)' : 'Desactivado'}`
    )
    if (nextState) {
      isUserManualScrollingRef.current = false
      setTimeout(() => {
        centerCursor(editor, { reason: 'force', duration: 130, force: true })
      }, 60)
    } else {
      cancelScrollAnimation()
      isUserManualScrollingRef.current = false
      lastAnchoredLineYRef.current = null
    }
  }, [
    preferences?.typewriterMode,
    onUpdatePreferences,
    showToast,
    centerCursor,
    editor,
    cancelScrollAnimation,
    currentLang
  ])

  // Alternar Alineación de Texto (Izquierda -> Justificado -> Centrado)
  const cycleTextAlign = useCallback(() => {
    if (!onUpdatePreferences) return
    const current = preferences?.textAlign || 'left'
    let next = 'left'
    let label = currentLang === 'en' ? 'Alignment: Left' : 'Alineación: Izquierda'

    if (current === 'left') {
      next = 'justify'
      label =
        currentLang === 'en'
          ? 'Alignment: Justified (Editorial)'
          : 'Alineación: Justificado (Editorial)'
    } else if (current === 'justify') {
      next = 'center'
      label = currentLang === 'en' ? 'Alignment: Centered' : 'Alineación: Centrado'
    } else {
      next = 'left'
      label = currentLang === 'en' ? 'Alignment: Left' : 'Alineación: Izquierda'
    }

    onUpdatePreferences({ textAlign: next })
    showToast(label)
  }, [preferences?.textAlign, onUpdatePreferences, showToast, currentLang])

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
      showToast(currentLang === 'en' ? `Font size: ${nextSize}` : `Tamaño de fuente: ${nextSize}`)
    },
    [preferences?.fontSize, onUpdatePreferences, showToast, currentLang]
  )

  const resetFontSize = useCallback(() => {
    if (!onUpdatePreferences) return
    onUpdatePreferences({ fontSize: '1.40rem' })
    showToast(currentLang === 'en' ? 'Standard size (1.40rem)' : 'Tamaño estándar (1.40rem)')
  }, [onUpdatePreferences, showToast, currentLang])

  // Controlar visibilidad del toolbar flotante al mover el ratón en Modo Zen
  const handleMouseMove = useCallback(() => {
    if (!isZenMode) return
    setIsMouseActive(true)
    if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current)
    mouseTimerRef.current = setTimeout(() => {
      setIsMouseActive(false)
    }, 2400)
  }, [isZenMode])

  // Atajos de teclado del editor (diferenciando Modo Zen y Modo Normal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.querySelector('[aria-modal="true"]')) return
      // Ocultar inmediatamente la barra flotante al escribir
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current)
      setIsMouseActive(false)

      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // 1. F11 o Ctrl+Shift+F: Alternar Modo Zen / Pantalla Completa
      if (e.key === 'F11' || (isCtrlOrMeta && e.shiftKey && (e.key === 'f' || e.key === 'F'))) {
        e.preventDefault()
        toggleZenMode()
        return
      }

      if (isCtrlOrMeta && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setIsManuscriptDropdownOpen(false)
        setActionsMenuOpen(false)
        setExportMenuOpen(false)
        openSearch()
        return
      }

      // 2. Escape: Cerrar modales, menús o salir de Modo Zen
      if (e.key === 'Escape') {
        if (isManuscriptDropdownOpen) {
          e.preventDefault()
          setIsManuscriptDropdownOpen(false)
          return
        }
        if (isShortcutsModalOpen) {
          e.preventDefault()
          setIsShortcutsModalOpen(false)
          return
        }
        if (isHistoryModalOpen) {
          e.preventDefault()
          setIsHistoryModalOpen(false)
          return
        }
        if (showStatsHud) {
          e.preventDefault()
          setShowStatsHud(false)
          return
        }
        if (exportMenuOpen) {
          e.preventDefault()
          setExportMenuOpen(false)
          return
        }
        if (actionsMenuOpen) {
          e.preventDefault()
          setActionsMenuOpen(false)
          return
        }
        if (isSearchOpen) {
          if (e.isComposing) return
          e.preventDefault()
          closeSearch()
          return
        }
        if (isZenMode) {
          e.preventDefault()
          toggleZenMode(false)
          return
        }
      }

      // 3. F1 o Ctrl+/: Guía de atajos minimalista
      if (e.key === 'F1' || (isCtrlOrMeta && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsModalOpen((prev) => {
          if (!prev) {
            setShortcutsTab(isZenMode ? 'zen' : 'workspace')
          }
          return !prev
        })
        return
      }

      // 4. Ctrl+H: Historial de versiones (recuperación de texto)
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setIsHistoryModalOpen((prev) => !prev)
        return
      }

      // 5. Ctrl+S: Guardar documento
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSave()
        return
      }

      // 6. Ctrl+Shift+S: Guardar copia como...
      if (isCtrlOrMeta && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        handleSaveAs()
        return
      }

      // 7. Ctrl+Shift+Y: Alternar Modo Máquina de Escribir (centrado de renglón activo)
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        toggleTypewriterMode()
        return
      }

      // 8. Ctrl+Shift+C: Mostrar / Ocultar estadísticas HUD
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setShowStatsHud((prev) => !prev)
        return
      }

      // 9. Ctrl+= / Ctrl++: Aumentar tamaño de fuente
      if (isCtrlOrMeta && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        adjustFontSize(1)
        return
      }

      // 10. Ctrl+- / Ctrl+_: Disminuir tamaño de fuente
      if (isCtrlOrMeta && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        adjustFontSize(-1)
        return
      }

      // 11. Ctrl+0: Restablecer tamaño de fuente
      if (isCtrlOrMeta && e.key === '0') {
        e.preventDefault()
        resetFontSize()
        return
      }

      // 12. Ctrl+, : Abrir configuración (en Modo Zen va a pestaña de escritura/zen)
      if (isCtrlOrMeta && !e.shiftKey && (e.key === ',' || e.key === '<')) {
        e.preventDefault()
        if (onOpenProfile) {
          onOpenProfile(isZenMode ? 'zen' : 'general')
        }
        return
      }

      // 13. Ctrl+Shift+T: Alternar Tema (Claro / Oscuro)
      if (isCtrlOrMeta && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        cycleTheme()
        return
      }

      // 14. Ctrl+Shift+L: Alternar tipografía (Serif -> Sans -> Mono)
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        cycleFontFamily()
        return
      }

      // --- ATAJOS EXCLUSIVOS DEL MODO NORMAL (Desactivados en Modo Zen para evitar distracciones) ---
      if (!isZenMode) {
        // Ctrl+Tab / Ctrl+Shift+Tab: Cambiar de carpeta/manuscrito abierto
        if (isCtrlOrMeta && e.key === 'Tab') {
          e.preventDefault()
          if (openedFolders.length > 1) {
            const currentIndex = openedFolders.findIndex((f) => f.path === openedFolder?.path)
            const delta = e.shiftKey ? -1 : 1
            const nextIndex = (currentIndex + delta + openedFolders.length) % openedFolders.length
            handleSelectFolderFromDropdown(openedFolders[nextIndex].path)
          }
          return
        }

        // Ctrl+N: Nuevo documento
        if (isCtrlOrMeta && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
          if (onNewDoc) {
            e.preventDefault()
            handleNewDocument()
            return
          }
        }

        // Ctrl+O: Abrir archivo directamente
        if (isCtrlOrMeta && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault()
          handleOpenFileDirectly()
          return
        }

        // Ctrl+Shift+O: Abrir carpeta de trabajo
        if (isCtrlOrMeta && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
          e.preventDefault()
          handleOpenFolderFromDropdown()
          return
        }

        // Ctrl+\: Alternar barra lateral del explorador
        if (isCtrlOrMeta && !e.shiftKey && e.key === '\\') {
          e.preventDefault()
          if (openedFolder) {
            setIsSidebarOpen((prev) => !prev)
          }
          return
        }

        // Ctrl+Shift+E o Ctrl+P: Conmutar menú de exportación
        if (
          (isCtrlOrMeta && e.shiftKey && (e.key === 'e' || e.key === 'E')) ||
          (isCtrlOrMeta && !e.shiftKey && (e.key === 'p' || e.key === 'P'))
        ) {
          e.preventDefault()
          setActionsMenuOpen(true)
          setExportMenuOpen((prev) => !prev)
          return
        }
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
    isHistoryModalOpen,
    isManuscriptDropdownOpen,
    openedFolders,
    handleSelectFolderFromDropdown,
    showStatsHud,
    actionsMenuOpen,
    exportMenuOpen,
    isSearchOpen,
    openSearch,
    closeSearch,
    openedFolder,
    toggleZenMode,
    handleSave,
    handleSaveAs,
    handleOpenFileDirectly,
    onNewDoc,
    handleOpenFolderFromDropdown,
    setIsSidebarOpen,
    handleNewDocument,
    onOpenProfile,
    toggleTypewriterMode,
    adjustFontSize,
    resetFontSize,
    cycleTheme,
    cycleFontFamily
  ])

  // Enfocar al hacer click en el lienzo fuera del texto
  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget && editor) {
      editor.commands.focus('end')
    }
  }

  // Cálculos estadísticos para escritores
  const plainText = isSourceMode ? session.state.content : editor ? editor.getText() : ''
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
            onClick={handleBack}
            title={t.editor.homeBtnTitle}
            aria-label={t.editor.homeBtn}
          >
            <ArrowLeftIcon size={17} />
            <span>{t.editor.homeBtn}</span>
          </button>

          {/* Botón dedicado para alternar el índice / barra lateral */}
          {openedFolder && (
            <button
              type="button"
              className={`btn-icon-sober ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title={isSidebarOpen ? t.editor.hideSidebar : t.editor.showSidebar}
              aria-label={t.editor.toggleSidebar}
            >
              <SidebarIcon size={16} />
            </button>
          )}

          {/* Grupo de Navegación: Carpeta y Flecha Desplegable para cambiar de manuscrito */}
          <div
            className={`header-folder-nav-group ${isManuscriptDropdownOpen ? 'is-open' : ''}`}
            ref={manuscriptDropdownRef}
          >
            {(openedFolder || filePath) && (
              <button
                type="button"
                className={`btn-header-folder ${isManuscriptDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsManuscriptDropdownOpen((prev) => !prev)}
                title={t.editor.switchManuscript || 'Cambiar manuscrito'}
                aria-label={t.editor.switchManuscript || 'Cambiar manuscrito'}
                aria-expanded={isManuscriptDropdownOpen}
                aria-haspopup="true"
              >
                {openedFolder ? (
                  <FolderIcon size={16} className="header-folder-icon" />
                ) : (
                  <FileTextIcon size={16} className="header-folder-icon" />
                )}
                <span className="header-folder-name">{openedFolder?.name || fileName}</span>
              </button>
            )}

            <button
              type="button"
              className={`btn-header-arrow ${isManuscriptDropdownOpen ? 'is-active' : ''}`}
              onClick={() => setIsManuscriptDropdownOpen((prev) => !prev)}
              title={t.editor.switchManuscript || 'Cambiar manuscrito'}
              aria-label={t.editor.switchManuscript || 'Cambiar manuscrito'}
              aria-expanded={isManuscriptDropdownOpen}
              aria-haspopup="true"
            >
              <ChevronDownIcon
                size={13}
                className={`header-arrow-chevron ${isManuscriptDropdownOpen ? 'is-open' : ''}`}
              />
            </button>

            {/* Menú Desplegable Rápido de Carpetas / Manuscritos */}
            {isManuscriptDropdownOpen && (
              <div className="manuscripts-quick-dropdown" role="menu">
                {(openedFolders.length > 0 || looseFiles.length > 0) && (
                  <div className="quick-dropdown-list">
                    {looseFiles.map((path) => (
                      <div
                        key={path}
                        className={`quick-dropdown-item ${!openedFolder && filePath === path ? 'is-active' : ''}`}
                      >
                        <button
                          type="button"
                          className="quick-dropdown-item-btn"
                          onClick={() => {
                            setIsManuscriptDropdownOpen(false)
                            handleSwitchDoc(path, null)
                          }}
                        >
                          <FileTextIcon size={14} className="dropdown-item-icon" />
                          <span className="dropdown-item-name" title={path}>
                            {path.split(/[\\/]/).pop()}
                          </span>
                        </button>
                      </div>
                    ))}
                    {openedFolders.map((folder) => {
                      const isActive = folder.path === openedFolder?.path
                      return (
                        <div
                          key={folder.path}
                          className={`quick-dropdown-item ${isActive ? 'is-active' : ''}`}
                        >
                          <button
                            type="button"
                            className="quick-dropdown-item-btn"
                            onClick={() => handleSelectFolderFromDropdown(folder.path)}
                          >
                            <FolderIcon size={14} className="dropdown-item-icon" />
                            <span className="dropdown-item-name" title={folder.path}>
                              {folder.name}
                            </span>
                          </button>
                          {openedFolders.length > 1 && onCloseFolder && (
                            <button
                              type="button"
                              className="btn-dropdown-item-close"
                              onClick={(e) => {
                                e.stopPropagation()
                                runTransition(() => onCloseFolder(folder.path))
                              }}
                              title={t.fileTree.closeFolder}
                              aria-label={t.fileTree.closeFolder}
                            >
                              <CloseIcon size={12} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="quick-dropdown-footer">
                  <button
                    type="button"
                    className="quick-dropdown-new-btn"
                    onClick={() => {
                      setIsManuscriptDropdownOpen(false)
                      handleOpenFileDirectly()
                    }}
                  >
                    <FileTextIcon size={13} />
                    <span>{t.home.openFile}</span>
                  </button>
                  <button
                    type="button"
                    className="quick-dropdown-new-btn"
                    onClick={handleOpenFolderFromDropdown}
                  >
                    <FolderIcon size={13} />
                    <span>{t.home.openFolder}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="doc-meta-header">
            <span className="doc-title-text" title={filePath || fileName}>
              {fileName}
            </span>
            {filePath && (
              <div className={`doc-status status-${saveStatus}`}>
                <span className="doc-status-dot" />
                <span className="doc-status-label">
                  {saveStatus === 'saved' && t.editor.statusSaved}
                  {saveStatus === 'unsaved' && t.editor.statusUnsaved}
                  {saveStatus === 'saving' && t.editor.statusSaving}
                  {saveStatus === 'error' && t.editor.statusError}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="header-right">
          {errorMessage && <span className="error-badge">{errorMessage}</span>}

          <button
            type="button"
            className={`btn-icon-sober ${isSearchOpen ? 'active' : ''}`}
            onClick={openSearch}
            title={`${t.search.title} (Ctrl+F)`}
            aria-label={t.search.title}
            aria-expanded={isSearchOpen}
            aria-controls={isSearchOpen ? 'manuscript-search' : undefined}
            aria-keyshortcuts="Control+F Meta+F"
            tabIndex={isZenMode ? -1 : undefined}
          >
            <SearchIcon size={16} aria-hidden="true" />
          </button>

          <button
            className={`btn-icon-sober ${preferences?.typewriterMode ? 'active' : ''}`}
            onClick={toggleTypewriterMode}
            title={t.editor.typewriterTitle(preferences?.typewriterMode)}
            aria-label={t.editor.typewriterAria}
          >
            <TypewriterIcon size={16} />
          </button>

          <button
            className={`btn-icon-sober ${preferences?.textAlign === 'justify' ? 'active' : ''}`}
            onClick={cycleTextAlign}
            title={t.editor.alignTitle(preferences?.textAlign)}
            aria-label={t.editor.alignAria}
          >
            {preferences?.textAlign === 'justify' ? (
              <AlignJustifyIcon size={16} />
            ) : preferences?.textAlign === 'center' ? (
              <AlignCenterIcon size={16} />
            ) : (
              <AlignLeftIcon size={16} />
            )}
          </button>

          <button
            className={`btn-icon-sober ${isZenMode ? 'active' : ''}`}
            onClick={() => toggleZenMode()}
            title={t.editor.zenModeTitle}
            aria-label={t.editor.zenModeAria}
          >
            <ZenFocusIcon size={16} />
          </button>

          <button
            className={`btn-icon-sober ${isHistoryModalOpen ? 'active' : ''}`}
            onClick={() => setIsHistoryModalOpen(true)}
            title={
              t.editor.historyTitle ||
              (currentLang === 'en'
                ? 'Version history (Ctrl+H)'
                : 'Historial de versiones (Ctrl+H)')
            }
            aria-label={t.editor.historyAria || 'Historial de versiones'}
          >
            <HistoryIcon size={16} />
          </button>

          <div className="header-divider" />

          {/* Menú Desplegable de Acciones (Guardar, Guardar como, Exportar, Preferencias) */}
          <div className="action-menu-wrapper" ref={actionsMenuRef}>
            {actionsMenuOpen && (
              <div className="action-menu-dock">
                {onOpenProfile && (
                  <button
                    className="btn-sober-secondary action-dock-btn"
                    onClick={() => {
                      setActionsMenuOpen(false)
                      onOpenProfile()
                    }}
                    title={t.editor.preferencesTitle}
                    aria-label={t.editor.preferencesAria}
                  >
                    <SettingsIcon size={15} />
                    <span className="header-btn-label">{t.editor.settingsBtn}</span>
                  </button>
                )}

                {/* Menú Desplegable de Exportación */}
                <div className="export-dropdown-wrapper" ref={exportDropdownRef}>
                  <button
                    className={`btn-sober-secondary export-trigger-btn ${exportMenuOpen ? 'is-active' : ''}`}
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    title={t.editor.exportTitle}
                    aria-label={t.editor.export}
                    aria-expanded={exportMenuOpen}
                    aria-haspopup="true"
                    disabled={isExporting}
                  >
                    <ExportIcon size={15} />
                    <span className="header-btn-label">{t.editor.export}</span>
                    <ChevronDownIcon
                      size={13}
                      className={`export-chevron ${exportMenuOpen ? 'is-open' : ''}`}
                    />
                  </button>

                  {exportMenuOpen && (
                    <div
                      className="export-dropdown-menu"
                      role="menu"
                      aria-label={t.editor.exportTitle}
                    >
                      <div className="export-dropdown-header">
                        <span className="export-dropdown-title">
                          {t.exportFormats?.menuTitle || t.editor.exportChooseFormat}
                        </span>
                      </div>
                      <div className="export-dropdown-list">
                        {EXPORT_OPTIONS.map((opt) => {
                          const IconComponent = opt.icon
                          const name = t.exportFormats?.[opt.nameKey] || opt.ext
                          const desc = t.exportFormats?.[opt.descKey] || ''
                          const badge =
                            t.exportFormats?.[opt.badgeKey] ||
                            opt.ext.replace('.', '').toUpperCase()

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              className="export-dropdown-item"
                              role="menuitem"
                              onClick={() => {
                                handleExport(opt.key)
                                setActionsMenuOpen(false)
                              }}
                            >
                              <div className="export-item-icon-wrapper">
                                <IconComponent size={16} />
                              </div>
                              <div className="export-item-content">
                                <div className="export-item-row">
                                  <span className="export-item-name">{name}</span>
                                  <span className="export-item-badge">{badge}</span>
                                </div>
                                {desc && <span className="export-item-desc">{desc}</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="btn-sober-secondary"
                  onClick={handleSaveAs}
                  title={t.editor.saveAsTitle}
                >
                  <SaveAsIcon size={15} />
                  <span className="header-btn-label">{t.editor.saveAs}</span>
                </button>

                <button
                  className="btn-sober-primary"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  title={t.editor.saveTitle}
                >
                  <SaveIcon size={15} />
                  <span className="header-btn-label">{t.editor.save}</span>
                </button>
              </div>
            )}

            {/* Recuadro con el icono que permanece visible en la cabecera en todo momento */}
            <button
              className={`btn-sober-secondary action-menu-trigger ${actionsMenuOpen ? 'is-active' : ''}`}
              onClick={() => {
                setActionsMenuOpen((prev) => !prev)
                if (actionsMenuOpen) setExportMenuOpen(false)
              }}
              title={actionsMenuOpen ? t.editor.closeActionsMenu : t.editor.actionsMenuTitle}
              aria-label={t.editor.actionsMenuAria}
              aria-expanded={actionsMenuOpen}
              aria-haspopup="true"
            >
              <MenuIcon size={15} />
              {!actionsMenuOpen && <span className="header-btn-label">{t.editor.actionsMenu}</span>}
              <ChevronDownIcon
                size={13}
                className={`action-menu-chevron ${actionsMenuOpen ? 'is-open' : ''}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Controles flotantes discretos en Modo Zen (visibles únicamente al mover el ratón) */}
      {isZenMode && preferences?.zenShowToolbar !== false && (
        <aside
          className={`zen-floating-toolbar ${isMouseActive ? 'visible' : ''}`}
          aria-label="Controles discretos de modo Zen"
        >
          <div className="zen-toolbar-pill">
            <button
              type="button"
              className={`zen-pill-btn zen-pill-icon-only ${isSearchOpen ? 'active' : ''}`}
              onClick={openSearch}
              title={`${t.search.title} (Ctrl+F)`}
              aria-label={t.search.title}
              aria-expanded={isSearchOpen}
              aria-controls={isSearchOpen ? 'manuscript-search' : undefined}
              aria-keyshortcuts="Control+F Meta+F"
            >
              <SearchIcon size={15} aria-hidden="true" />
            </button>
            <button
              className={`zen-pill-btn zen-pill-icon-only ${preferences?.typewriterMode ? 'active' : ''}`}
              onClick={toggleTypewriterMode}
              title={t.editor.typewriterTitle(preferences?.typewriterMode)}
              aria-label={t.editor.typewriterAria}
            >
              <TypewriterIcon size={15} />
            </button>
            <button
              className={`zen-pill-btn zen-pill-icon-only ${preferences?.textAlign === 'justify' ? 'active' : ''}`}
              onClick={cycleTextAlign}
              title={t.editor.alignTitle(preferences?.textAlign)}
              aria-label={t.editor.alignAria}
            >
              {preferences?.textAlign === 'justify' ? (
                <AlignJustifyIcon size={15} />
              ) : preferences?.textAlign === 'center' ? (
                <AlignCenterIcon size={15} />
              ) : (
                <AlignLeftIcon size={15} />
              )}
            </button>
            <button
              className="zen-pill-btn zen-pill-icon-only"
              onClick={() => setIsHistoryModalOpen(true)}
              title={
                t.editor.historyTitle ||
                (currentLang === 'en'
                  ? 'Version history (Ctrl+H)'
                  : 'Historial de versiones (Ctrl+H)')
              }
              aria-label={t.editor.historyAria || 'Historial de versiones'}
            >
              <HistoryIcon size={15} />
            </button>
            <button
              className="zen-pill-btn zen-pill-icon-only"
              onClick={() => {
                setShortcutsTab('zen')
                setIsShortcutsModalOpen(true)
              }}
              title={t.editor.shortcutsBtnTitle}
              aria-label={t.editor.shortcutsBtnAria}
            >
              <KeyboardIcon size={15} />
            </button>
            {onOpenProfile && (
              <button
                className="zen-pill-btn zen-pill-icon-only"
                onClick={() => onOpenProfile('zen')}
                title={
                  t.editor.zenSettingsTitle ||
                  (currentLang === 'en'
                    ? 'Customize Zen Mode & floating windows (Ctrl+,)'
                    : 'Personalizar Modo Zen y ventanas flotantes (Ctrl+,)')
                }
                aria-label={t.editor.zenSettingsAria || 'Personalizar Modo Zen'}
              >
                <SettingsIcon size={15} />
              </button>
            )}
            <div className="zen-pill-divider" />
            <button
              className="zen-pill-btn zen-pill-exit"
              onClick={() => toggleZenMode(false)}
              title={t.editor.zenExitTitle}
            >
              <span>{t.editor.zenExit}</span>
              <kbd className="zen-kbd-hint">Esc</kbd>
            </button>
          </div>
        </aside>
      )}

      {/* Barra flotante minimalista de estadísticas en Modo Zen (inferior derecha) */}
      {isZenMode && preferences?.zenShowStats !== false && (
        <aside
          className={`zen-floating-stats ${isMouseActive ? 'visible' : ''}`}
          aria-label={t.stats.title}
        >
          <div className="zen-stats-pill">
            <span className="zen-stats-pill-item">
              <strong>{words}</strong>{' '}
              {words === 1 ? t.stats.wordSingular.toLowerCase() : t.stats.words.toLowerCase()}
            </span>
            <span className="zen-stats-pill-sep">•</span>
            <span className="zen-stats-pill-item">
              <strong>{characters}</strong> {t.stats.characters.toLowerCase()}
            </span>
            <span className="zen-stats-pill-sep">•</span>
            <span className="zen-stats-pill-item">
              <strong>{paragraphs}</strong>{' '}
              {paragraphs === 1
                ? t.stats.paragraphSingular.toLowerCase()
                : t.stats.paragraphs.toLowerCase()}
            </span>
            <span className="zen-stats-pill-sep">•</span>
            <span
              className="zen-stats-pill-item"
              title={readingTime === 1 ? t.stats.readingTimeSingle : t.stats.readingTimePlural}
            >
              <strong>~{readingTime}</strong>{' '}
              {currentLang === 'en' ? (readingTime === 1 ? 'min' : 'mins') : 'min'}
            </span>
          </div>
        </aside>
      )}

      {/* Notificación flotante efímera (Toast) */}
      {toast && (
        <div className={`zen-toast zen-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="zen-toast-text">{toast.message}</span>
        </div>
      )}

      {/* Ventana flotante de notas y subcarpetas en Modo Zen (superior izquierda) */}
      {isZenMode && openedFolder && preferences?.zenShowFolder !== false && (
        <ZenFloatingFolder
          openedFolder={openedFolder}
          activeFilePath={filePath}
          onSelectFile={handleSwitchDoc}
          runMutation={runTransition}
          onItemRenamed={handleItemRenamed}
          onItemDeleted={handleItemDeleted}
          onRefreshTree={onRefreshFolderTree}
          showToast={showToast}
          isMouseActive={isMouseActive}
          language={preferences?.language}
        />
      )}

      {/* HUD de Estadísticas Flotante (Ctrl+Shift+C) */}
      {showStatsHud && (
        <div className="zen-stats-overlay" onClick={() => setShowStatsHud(false)}>
          <div
            className="zen-stats-card"
            onClick={(e) => e.stopPropagation()}
            role="region"
            aria-label={t.stats.title}
          >
            <div className="zen-stats-header">
              <h3 className="zen-stats-title">{t.stats.title}</h3>
              <button
                className="btn-icon-subtle"
                onClick={() => setShowStatsHud(false)}
                title={t.stats.closeTitle}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="zen-stats-grid">
              <div className="zen-stat-box">
                <span className="zen-stat-num">{words}</span>
                <span className="zen-stat-name">
                  {words === 1 ? t.stats.wordSingular : t.stats.words}
                </span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">{characters}</span>
                <span className="zen-stat-name">{t.stats.characters}</span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">~{readingTime}</span>
                <span className="zen-stat-name">
                  {readingTime === 1 ? t.stats.readingTimeSingle : t.stats.readingTimePlural}
                </span>
              </div>
              <div className="zen-stat-box">
                <span className="zen-stat-num">{paragraphs}</span>
                <span className="zen-stat-name">
                  {paragraphs === 1 ? t.stats.paragraphSingular : t.stats.paragraphs}
                </span>
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

      {/* Modal Guía de Atajos de Teclado (F1 o Ctrl+/) */}
      {isShortcutsModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsShortcutsModalOpen(false)}>
          <div
            className="modal-card modal-card-shortcuts"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
          >
            <header className="modal-header-wide">
              <div className="modal-header-title-bar">
                <h2 id="shortcuts-title" className="modal-title">
                  {t.shortcuts.title}
                </h2>
                <button
                  className="btn-icon-subtle"
                  onClick={() => setIsShortcutsModalOpen(false)}
                  aria-label={t.shortcuts.closeTitle}
                  title={`${t.shortcuts.closeTitle} (Esc)`}
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              {/* Navegación segmentada: Modo Zen vs Espacio de Trabajo */}
              <nav className="modal-segmented-nav" aria-label="Categorías de atajos">
                <button
                  type="button"
                  className={`segmented-tab-btn ${shortcutsTab === 'zen' ? 'is-active' : ''}`}
                  onClick={() => setShortcutsTab('zen')}
                >
                  <FeatherIcon size={15} />
                  <span>{t.shortcuts.tabs.zen}</span>
                </button>
                <button
                  type="button"
                  className={`segmented-tab-btn ${shortcutsTab === 'workspace' ? 'is-active' : ''}`}
                  onClick={() => setShortcutsTab('workspace')}
                >
                  <FolderTreeIcon size={15} />
                  <span>{t.shortcuts.tabs.workspace}</span>
                </button>
              </nav>
            </header>

            <div className="modal-body modal-body-wide shortcuts-modal-body">
              <div className="pref-row">
                <div className="pref-row-info">
                  <span className="pref-row-title">{t.search.title}</span>
                </div>
                <div className="pref-row-control">
                  <div className="shortcut-kbd-group">
                    <kbd className="shortcut-kbd">Ctrl</kbd>
                    <span className="shortcut-kbd-sep">+</span>
                    <kbd className="shortcut-kbd">F</kbd>
                  </div>
                </div>
              </div>
              {shortcutsTab === 'zen' && (
                <div className="shortcuts-tab-panel">
                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.saveDoc}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">S</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.saveCopy}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">S</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.versionHistory}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">H</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.toggleTypewriter}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Y</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.toggleStats}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">C</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.exitZen}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Esc</kbd>
                        <span className="shortcut-kbd-or">{t.shortcuts.keys.or}</span>
                        <kbd className="shortcut-kbd">F11</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.preferencesZen}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">,</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.fontSizeAdjust}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">+</kbd>
                        <span className="shortcut-kbd-sep">/</span>
                        <kbd className="shortcut-kbd">-</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.viewShortcuts}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">F1</kbd>
                        <span className="shortcut-kbd-or">{t.shortcuts.keys.or}</span>
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">/</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shortcutsTab === 'workspace' && (
                <div className="shortcuts-tab-panel">
                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.newDoc}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">N</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.openMarkdown}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">O</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.openWorkspace}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">O</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.toggleSidebar}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">\</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.exportDoc}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">E</kbd>
                        <span className="shortcut-kbd-or">{t.shortcuts.keys.or}</span>
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">P</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.toggleZen}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">F11</kbd>
                        <span className="shortcut-kbd-or">{t.shortcuts.keys.or}</span>
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">Shift</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">F</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.versionHistory}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">H</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.shortcuts.keys.preferencesGeneral}</span>
                    </div>
                    <div className="pref-row-control">
                      <div className="shortcut-kbd-group">
                        <kbd className="shortcut-kbd">Ctrl</kbd>
                        <span className="shortcut-kbd-sep">+</span>
                        <kbd className="shortcut-kbd">,</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Versiones */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        docKey={filePath || (initialDoc?.id ? `draft_${initialDoc.id}` : 'temp_doc')}
        docName={fileName}
        currentContent={getMarkdownContent()}
        onRestoreVersion={handleRestoreVersion}
        preferences={preferences}
        showToast={showToast}
      />

      {/* Disposición dividida para panel lateral y lienzo */}
      <div className="editor-workspace-layout">
        {isSidebarOpen && !isZenMode && openedFolder && (
          <aside className="editor-sidebar-panel">
            <FileTree
              key={openedFolder.path}
              openedFolder={openedFolder}
              activeFilePath={filePath}
              onSelectFile={handleSwitchDoc}
              runMutation={runTransition}
              onItemRenamed={handleItemRenamed}
              onItemDeleted={handleItemDeleted}
              onRefreshTree={() => onRefreshFolderTree?.(openedFolder.path)}
              onCloseFolder={() => runTransition(() => onCloseFolder?.(openedFolder.path))}
              showToast={showToast}
              language={preferences?.language}
            />
          </aside>
        )}

        <div className="editor-document-panel">
          {isSearchOpen && <ManuscriptSearch search={search} labels={t.search} />}
          <main className="editor-main" ref={scrollContainerRef} onClick={handleCanvasClick}>
            <div
              className={`editor-canvas ${preferences?.typewriterMode ? `typewriter-mode-active typewriter-pos-${preferences?.typewriterPosition || 'center'}` : ''}`}
              onClick={handleCanvasClick}
            >
              {isSourceMode && (
                <>
                  <p role="status" className="source-editor-notice">
                    {currentLang === 'en'
                      ? 'Source editing preserves the document’s original text and Markdown syntax.'
                      : 'La edición de fuente conserva el texto y la sintaxis original del documento.'}
                  </p>
                  <SourceEditor
                    content={source}
                    search={search}
                    onReveal={revealSearchMatch}
                    spellCheck={preferences.spellcheckEnabled !== false}
                    onChange={(event) => {
                      if (!transitionRef.current) session.change(event.target.value)
                    }}
                  />
                </>
              )}
              <EditorContent
                style={isSourceMode ? { display: 'none' } : undefined}
                editor={editor}
                className="tiptap-wrapper"
              />
            </div>
          </main>
        </div>
      </div>

      {/* Barra de estado discreta inferior (se oculta totalmente en Zen) */}
      <footer className="editor-footer">
        <div className="footer-stats">
          <span className="stat-item">
            <strong>{words}</strong>{' '}
            {words === 1
              ? currentLang === 'en'
                ? 'word'
                : 'palabra'
              : currentLang === 'en'
                ? 'words'
                : 'palabras'}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <strong>{characters}</strong> {currentLang === 'en' ? 'characters' : 'caracteres'}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <strong>~{readingTime}</strong>{' '}
            {readingTime === 1
              ? currentLang === 'en'
                ? 'min read'
                : 'min de lectura'
              : currentLang === 'en'
                ? 'mins read'
                : 'mins de lectura'}
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
