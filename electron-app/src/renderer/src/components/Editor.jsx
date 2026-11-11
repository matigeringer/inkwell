import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  ArrowLeftIcon,
  ZenFocusIcon,
  CloseIcon,
  SidebarIcon,
  TypewriterIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon,
  HistoryIcon,
  SearchIcon
} from './Icons'
import FileTree from './FileTree'
import EditorFileMenu from './EditorFileMenu'
import EditorActionsMenu from './EditorActionsMenu'
import ZenToolbar from './ZenToolbar'
import HistoryModal from './HistoryModal'
import ShortcutsModal from './ShortcutsModal'
import ManuscriptSearch from './ManuscriptSearch'
import SourceEditor from './SourceEditor'
import ZenFloatingFolder from './ZenFloatingFolder'
import WorkspaceSearch from './WorkspaceSearch'
import { getTranslation } from '../i18n'
import useDocumentPersistence from '../hooks/useDocumentPersistence'
import useManuscriptSearch from '../hooks/useManuscriptSearch'
import useTypewriterScroll from '../hooks/useTypewriterScroll'
import useEditorShortcuts from '../hooks/useEditorShortcuts'
import useEditorHistory from '../hooks/useEditorHistory'
import { saveDraft } from '../lib/drafts'
import {
  DEFAULT_PREFERENCES,
  FONT_SIZES,
  resolveColorMode,
  SYSTEM_DARK_QUERY
} from '../lib/preferences'
import { needsSourceEditor } from '../lib/markdownSupport'
import { isSameOrDescendant, pathAfterRename, pathName } from '../lib/workspaceTree'
import {
  manuscriptTextBlocks,
  revealMatch,
  revealSourceMatch,
  SearchHighlights
} from '../lib/manuscriptSearch'
import { countWords } from '../../../shared/textStats'
import { locateWorkspaceMatch, normalizeSource } from '../../../shared/workspaceMatch'

export default function Editor({
  initialDoc,
  onSelectFile,
  onOpenFile,
  onBack,
  preferences,
  onUpdatePreferences,
  onOpenProfile,
  openedFolder,
  openedFolders = [],
  looseFiles = [],
  isZenMode = false,
  setIsZenMode,
  workspaceSearch,
  workspaceJump,
  onOpenWorkspaceResult,
  onFinishWorkspaceJump,
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
  const [workspaceHighlight, setWorkspaceHighlight] = useState(null)
  const toastTimeoutRef = useRef(null)
  const showToast = useCallback((message, type = 'info') => {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, type, id: Date.now() })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => clearTimeout(toastTimeoutRef.current), [])
  const draftKey = initialDoc?.id ? `draft_${initialDoc.id}` : 'temp_doc'
  const { saveSnapshot, moveHistory, recordPersisted } = useEditorHistory({
    draftKey,
    enabled: preferences.historyEnabled !== false,
    interval: preferences.historySnapshotInterval || DEFAULT_PREFERENCES.historySnapshotInterval,
    maxEntries: preferences.historyMaxEntries || DEFAULT_PREFERENCES.historyMaxEntries,
    showToast
  })
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
    onPersist: recordPersisted,
    showToast
  })
  const [isSourceMode, setIsSourceMode] = useState(
    () => needsSourceEditor(initialDoc?.content) || /\.txt$/i.test(initialDoc?.fileName || '')
  )
  const transitionRef = useRef(false)
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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isMouseActive, setIsMouseActive] = useState(false)
  const mouseTimerRef = useRef(null)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const actionsMenuRef = useRef(null)
  const exportDropdownRef = useRef(null)
  const manuscriptDropdownRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const typewriterEnabled = Boolean(preferences?.typewriterMode)
  const typewriterPosition = preferences?.typewriterPosition || 'center'
  const typewriterBehavior = preferences?.typewriterBehavior || 'deadzone'
  const typewriter = useTypewriterScroll(scrollContainerRef, {
    enabled: typewriterEnabled,
    position: typewriterPosition,
    behavior: typewriterBehavior
  })
  const { centerCaret, cancelScroll } = typewriter

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

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [actionsMenuOpen, exportMenuOpen, isManuscriptDropdownOpen])

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
    autofocus: workspaceJump || workspaceSearch?.isOpen ? false : 'end',
    editorProps: {
      attributes: {
        class: 'fountain-editor-content',
        spellcheck: preferences?.spellcheckEnabled !== false ? 'true' : 'false',
        lang: currentLang === 'en' ? 'en' : 'es'
      },
      handleDOMEvents: {
        keydown: typewriter.onKeyDown,
        mousedown: typewriter.onMouseDown,
        mouseup: () => typewriter.onMouseUp(editor)
      }
    },
    onSelectionUpdate: typewriter.onSelectionUpdate,
    onUpdate: ({ editor }) => {
      if (isSourceMode) return
      session.change(editor.storage.markdown.getMarkdown())
      typewriter.onDocumentUpdate(editor)
    },
    onFocus: typewriter.onFocus
  })

  const revealSearchMatch = useCallback(
    (match) => {
      const container = scrollContainerRef.current
      if (!container) return
      cancelScroll()
      revealMatch(container, match)
    },
    [cancelScroll]
  )
  // Textareas normalize line endings, so highlight offsets use the same text as the input.
  const source = isSourceMode ? normalizeSource(session.state.content) : null
  const sourceRef = useRef(null)
  const workspaceMatch =
    workspaceHighlight &&
    workspaceSearch?.isOpen &&
    workspaceHighlight.requestId === workspaceSearch?.result?.id &&
    workspaceHighlight.revision === session.state.revision &&
    workspaceHighlight.filePath === filePath
      ? workspaceHighlight.range
      : null
  const search = useManuscriptSearch({
    editor,
    source,
    sourceRef,
    workspaceMatch,
    onReveal: revealSearchMatch
  })
  const { isOpen: isSearchOpen, open: openSearch, close: closeSearch } = search
  const isWorkspaceSearchOpen = workspaceSearch?.isOpen
  const closeSearchPanel = workspaceSearch?.close
  const closeWorkspaceSearch = useCallback(
    (options) => {
      setWorkspaceHighlight(null)
      closeSearchPanel?.({ fallback: sourceRef.current ?? editor?.view.dom, ...options })
    },
    [closeSearchPanel, editor]
  )

  useEffect(() => {
    if (!workspaceJump || workspaceJump.path !== filePath || !editor) return
    let canceled = false
    async function jump() {
      const content = session.state.content
      let version
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
        version = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')
      }
      if (canceled || editor.isDestroyed || session.state.filePath !== filePath) return
      const surface = isSourceMode ? sourceRef.current : editor.view.dom
      surface.focus({ preventScroll: true })
      const blocks = isSourceMode
        ? [{ text: surface.value, start: 0 }]
        : manuscriptTextBlocks(editor.state.doc)
      const range = locateWorkspaceMatch(
        blocks,
        workspaceJump.match,
        version === workspaceJump.version && content === session.state.content
      )
      if (range) {
        cancelScroll()
        if (isSourceMode) revealSourceMatch(surface, range, revealSearchMatch)
        else editor.chain().setTextSelection(range.from).scrollIntoView().run()
        setWorkspaceHighlight({
          range,
          requestId: workspaceJump.requestId,
          revision: session.state.revision,
          filePath
        })
      }
      onFinishWorkspaceJump(workspaceJump, Boolean(range))
    }
    const frame = requestAnimationFrame(() => {
      jump().catch(() => {
        if (!canceled) onFinishWorkspaceJump(workspaceJump, false)
      })
    })
    return () => {
      canceled = true
      cancelAnimationFrame(frame)
    }
  }, [
    workspaceJump,
    filePath,
    editor,
    isSourceMode,
    session,
    sourceRef,
    cancelScroll,
    revealSearchMatch,
    onFinishWorkspaceJump
  ])

  useEffect(() => {
    if (!typewriterEnabled || !editor || isSourceMode) return
    const recenter = () => centerCaret(editor, { force: true, duration: 130 })
    const timer = setTimeout(recenter, 80)
    window.addEventListener('resize', recenter)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', recenter)
      cancelScroll()
    }
  }, [
    editor,
    isSourceMode,
    typewriterEnabled,
    typewriterPosition,
    typewriterBehavior,
    centerCaret,
    cancelScroll
  ])

  useEffect(() => {
    if (editor?.view?.dom) {
      editor.view.dom.setAttribute(
        'spellcheck',
        preferences?.spellcheckEnabled !== false ? 'true' : 'false'
      )
      editor.view.dom.setAttribute('lang', preferences?.language === 'en' ? 'en' : 'es')
    }
  }, [editor, preferences?.spellcheckEnabled, preferences?.language])

  const getMarkdownContent = useCallback(() => {
    if (isSourceMode || !editor) return session.state.content
    return editor.storage.markdown.getMarkdown()
  }, [editor, session, isSourceMode])

  const runExclusive = useCallback(
    async (action) => {
      if (transitionRef.current) return false
      transitionRef.current = true
      editor?.setEditable(false, false)
      try {
        return await action()
      } catch (error) {
        showToast(error.message, 'error')
        return false
      } finally {
        transitionRef.current = false
        if (editor && !editor.isDestroyed) editor.setEditable(true, false)
      }
    },
    [editor, showToast]
  )

  const runTransition = useCallback(
    (action) => runExclusive(async () => ((await saveBeforeSwitch()) ? action() : false)),
    [runExclusive, saveBeforeSwitch]
  )

  const handleRestoreVersion = useCallback(
    (restoredContent, snapshot) =>
      runExclusive(async () => {
        cancelAutoSave()
        await session.pending
        const { content, filePath, fileName } = session.state
        await saveSnapshot({ trigger: 'manual', content, filePath, fileName })
        setIsSourceMode(needsSourceEditor(restoredContent) || /\.txt$/i.test(fileName))
        editor?.commands.setContent(restoredContent, { emitUpdate: false })
        session.change(restoredContent)
        if (preferences.autoSaveEnabled !== false) await session.flush()
        const timestamp = new Date(snapshot.timestamp).toLocaleTimeString()
        showToast(
          currentLang === 'en'
            ? `Version restored (${timestamp})`
            : `Versión restaurada (${timestamp})`
        )
        return true
      }),
    [
      runExclusive,
      cancelAutoSave,
      session,
      saveSnapshot,
      editor,
      preferences.autoSaveEnabled,
      showToast,
      currentLang
    ]
  )

  const handleItemRenamed = useCallback(
    async (result) => {
      const current = session.state.filePath
      const next = pathAfterRename(current, result)
      if (current && next !== current) {
        const name = pathName(next)
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
      if (current && isSameOrDescendant(result.targetPath, current)) {
        saveDraft(session.state)
        session.relocate(null, session.state.fileName)
        onSavedFile?.(null, session.state.fileName, session.state.content)
        await moveHistory({
          fromKey: current,
          toKey: draftKey,
          fileName: session.state.fileName,
          filePath: null
        })
      }
      await onItemDeleted?.(result)
    },
    [session, draftKey, moveHistory, onSavedFile, onItemDeleted]
  )

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

        const res = await window.api.exportDocument({
          format,
          filePath,
          fileName,
          content: markdownContent
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
    [filePath, fileName, getMarkdownContent, showToast, currentLang, t]
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
  const handleWorkspaceResult = (group, match) => {
    if (transitionRef.current) return false
    return group.path === session.state.filePath
      ? onOpenWorkspaceResult(group, match, true)
      : runTransition(() => onOpenWorkspaceResult(group, match))
  }
  const handleOpenFileDirectly = useCallback(
    () => runTransition(() => onOpenFile?.()),
    [runTransition, onOpenFile]
  )

  useEffect(() => {
    return window.api?.onRequestClose?.(() => runTransition(() => true))
  }, [runTransition])

  const toggleZenMode = useCallback(
    async (forcedState) => {
      const nextState = typeof forcedState === 'boolean' ? forcedState : !isZenMode
      setIsZenMode?.(nextState)

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
    [isZenMode, setIsZenMode, preferences, showToast, t]
  )

  const cycleTheme = useCallback(() => {
    if (!onUpdatePreferences) return
    const currentMode = resolveColorMode(
      preferences.mode,
      window.matchMedia(SYSTEM_DARK_QUERY).matches
    )
    const nextMode = currentMode === 'dark' ? 'light' : 'dark'
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

  const toggleTypewriterMode = useCallback(() => {
    if (!onUpdatePreferences) return
    const nextState = !preferences?.typewriterMode
    onUpdatePreferences({ typewriterMode: nextState })
    showToast(
      currentLang === 'en'
        ? `Typewriter Mode: ${nextState ? 'Active (Centered line)' : 'Disabled'}`
        : `Modo Máquina de Escribir: ${nextState ? 'Activado (Línea centrada)' : 'Desactivado'}`
    )
  }, [preferences?.typewriterMode, onUpdatePreferences, showToast, currentLang])

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

  const adjustFontSize = useCallback(
    (delta) => {
      if (!onUpdatePreferences) return
      const current = preferences?.fontSize || DEFAULT_PREFERENCES.fontSize
      const currentIndex = FONT_SIZES.indexOf(current)

      let nextSize = current
      if (currentIndex !== -1) {
        const nextIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, currentIndex + delta))
        nextSize = FONT_SIZES[nextIndex]
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
    onUpdatePreferences({ fontSize: DEFAULT_PREFERENCES.fontSize })
    showToast(currentLang === 'en' ? 'Standard size (1.40rem)' : 'Tamaño estándar (1.40rem)')
  }, [onUpdatePreferences, showToast, currentLang])

  const hideZenControls = useCallback(() => {
    clearTimeout(mouseTimerRef.current)
    setIsMouseActive(false)
  }, [])
  const handleMouseMove = useCallback(() => {
    if (!isZenMode) return
    setIsMouseActive(true)
    clearTimeout(mouseTimerRef.current)
    mouseTimerRef.current = setTimeout(hideZenControls, 2400)
  }, [isZenMode, hideZenControls])
  useEffect(() => () => clearTimeout(mouseTimerRef.current), [])

  function cycleFolder(direction) {
    if (openedFolders.length < 2) return
    const index = openedFolders.findIndex((folder) => folder.path === openedFolder?.path)
    const next = (index + direction + openedFolders.length) % openedFolders.length
    handleSelectFolderFromDropdown(openedFolders[next].path)
  }

  function dismissOverlay(event) {
    if (isManuscriptDropdownOpen) setIsManuscriptDropdownOpen(false)
    else if (showStatsHud) setShowStatsHud(false)
    else if (exportMenuOpen) setExportMenuOpen(false)
    else if (actionsMenuOpen) setActionsMenuOpen(false)
    else if (event.isComposing) return false
    else if (isWorkspaceSearchOpen && document.activeElement?.closest('.workspace-search')) {
      closeWorkspaceSearch()
    } else if (isSearchOpen) closeSearch()
    else if (isWorkspaceSearchOpen) closeWorkspaceSearch({ restoreFocus: false })
    else if (isZenMode) toggleZenMode(false)
    else return false
    return true
  }

  useEditorShortcuts({
    isZenMode,
    hideZenControls,
    dismissOverlay,
    commands: {
      toggleZen: toggleZenMode,
      openHelp: () => setIsShortcutsModalOpen(true),
      openSearch: () => {
        setIsManuscriptDropdownOpen(false)
        setActionsMenuOpen(false)
        setExportMenuOpen(false)
        openSearch()
      },
      openHistory: () => setIsHistoryModalOpen(true),
      save: handleSave,
      saveAs: handleSaveAs,
      toggleTypewriter: toggleTypewriterMode,
      toggleStats: () => setShowStatsHud((open) => !open),
      increaseFontSize: () => adjustFontSize(1),
      decreaseFontSize: () => adjustFontSize(-1),
      resetFontSize,
      openPreferences: () => onOpenProfile?.(isZenMode ? 'zen' : 'general'),
      toggleTheme: cycleTheme,
      cycleFont: cycleFontFamily,
      nextFolder: () => cycleFolder(1),
      previousFolder: () => cycleFolder(-1),
      newDocument: onNewDoc ? handleNewDocument : undefined,
      openFile: handleOpenFileDirectly,
      openFolder: handleOpenFolderFromDropdown,
      toggleSidebar: () => {
        if (openedFolder) setIsSidebarOpen((open) => !open)
      },
      toggleExport: () => {
        setActionsMenuOpen(true)
        setExportMenuOpen((open) => !open)
      }
    }
  })

  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget && editor) {
      editor.commands.focus('end')
    }
  }

  const plainText = isSourceMode ? session.state.content : editor ? editor.getText() : ''
  const words = countWords(plainText)
  const characters = plainText.length
  const readingTime = Math.max(1, Math.ceil(words / 200))
  const paragraphs = plainText.split(/\n+/).filter((p) => p.trim().length > 0).length

  return (
    <div
      className={`editor-view ${isZenMode ? 'zen-mode-active' : ''}`}
      onMouseMove={handleMouseMove}
    >
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
          <EditorFileMenu
            t={t}
            isOpen={isManuscriptDropdownOpen}
            setOpen={setIsManuscriptDropdownOpen}
            menuRef={manuscriptDropdownRef}
            openedFolder={openedFolder}
            openedFolders={openedFolders}
            looseFiles={looseFiles}
            filePath={filePath}
            fileName={fileName}
            onSelectFile={handleSwitchDoc}
            onSelectFolder={handleSelectFolderFromDropdown}
            onCloseFolder={onCloseFolder && ((path) => runTransition(() => onCloseFolder(path)))}
            onOpenFile={handleOpenFileDirectly}
            onOpenFolder={handleOpenFolderFromDropdown}
          />

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

          <EditorActionsMenu
            t={t}
            actionsOpen={actionsMenuOpen}
            setActionsOpen={setActionsMenuOpen}
            actionsRef={actionsMenuRef}
            exportOpen={exportMenuOpen}
            setExportOpen={setExportMenuOpen}
            exportRef={exportDropdownRef}
            isExporting={isExporting}
            saveStatus={saveStatus}
            onOpenProfile={onOpenProfile}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onExport={handleExport}
          />
        </div>
      </header>

      {isZenMode && preferences?.zenShowToolbar !== false && (
        <ZenToolbar
          t={t}
          currentLang={currentLang}
          preferences={preferences}
          visible={isMouseActive}
          isSearchOpen={isSearchOpen}
          openSearch={openSearch}
          toggleTypewriterMode={toggleTypewriterMode}
          cycleTextAlign={cycleTextAlign}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
          onOpenProfile={onOpenProfile}
          onExit={() => toggleZenMode(false)}
        />
      )}

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

      {toast && (
        <div className={`zen-toast zen-toast-${toast.type}`} role="status" aria-live="polite">
          <span className="zen-toast-text">{toast.message}</span>
        </div>
      )}

      {isZenMode && openedFolder && preferences?.zenShowFolder !== false && (
        <ZenFloatingFolder
          hidden={isWorkspaceSearchOpen}
          openedFolder={openedFolder}
          activeFilePath={filePath}
          onSelectFile={handleSwitchDoc}
          runMutation={runTransition}
          onItemRenamed={handleItemRenamed}
          onItemDeleted={handleItemDeleted}
          onRefreshTree={onRefreshFolderTree}
          onSearchFolder={workspaceSearch?.open}
          showToast={showToast}
          isMouseActive={isMouseActive}
          language={preferences?.language}
        />
      )}

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

      {isShortcutsModalOpen && (
        <ShortcutsModal
          isZenMode={isZenMode}
          workspaceSearchEnabled={Boolean(workspaceSearch)}
          labels={t}
          onClose={() => setIsShortcutsModalOpen(false)}
        />
      )}

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        docKey={filePath || draftKey}
        docName={fileName}
        currentContent={getMarkdownContent()}
        onRestoreVersion={handleRestoreVersion}
        preferences={preferences}
        showToast={showToast}
      />

      <div className="editor-workspace-layout">
        {isWorkspaceSearchOpen && (
          <aside className="editor-sidebar-panel workspace-search-panel">
            <WorkspaceSearch
              search={workspaceSearch}
              labels={t.workspaceSearch}
              navigationLabels={t.search}
              getActiveFile={() => {
                const { filePath, content } = session.state
                return filePath ? { path: filePath, content, sourceMode: isSourceMode } : null
              }}
              onOpen={handleWorkspaceResult}
              onClose={closeWorkspaceSearch}
            />
          </aside>
        )}
        {isSidebarOpen && !isZenMode && openedFolder && (
          <aside className="editor-sidebar-panel" hidden={isWorkspaceSearchOpen}>
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
              onSearchFolder={workspaceSearch?.open}
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
                    workspaceMatch={workspaceMatch}
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
