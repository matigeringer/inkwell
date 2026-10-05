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
  SidebarIcon,
  TypewriterIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon
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
  const scrollContainerRef = useRef(null)
  const typewriterModeRef = useRef(Boolean(preferences?.typewriterMode))
  const typewriterPositionRef = useRef(preferences?.typewriterPosition || 'center')
  const typewriterBehaviorRef = useRef(preferences?.typewriterBehavior || 'deadzone')
  const isUserManualScrollingRef = useRef(false)
  const scrollAnimationRef = useRef({ rafId: null })
  const lastAnchoredLineYRef = useRef(null)
  const isMouseDownRef = useRef(false)
  const [, setTick] = useState(0) // Forzar re-render en cambios para estadísticas

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
      setSaveStatus('unsaved')
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
    const modeName = nextMode === 'dark' ? 'Oscuro' : 'Claro'
    showToast(`Modo ${modeName}`)
  }, [preferences?.mode, onUpdatePreferences, showToast])

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
    showToast(`Tipografía: ${fontName}`)
  }, [preferences?.fontFamily, onUpdatePreferences, showToast])

  // Alternar Modo Máquina de Escribir (Typewriter Scrolling)
  const toggleTypewriterMode = useCallback(() => {
    if (!onUpdatePreferences) return
    const nextState = !preferences?.typewriterMode
    onUpdatePreferences({ typewriterMode: nextState })
    showToast(
      `Modo Máquina de Escribir: ${nextState ? 'Activado (Línea centrada)' : 'Desactivado'}`
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
    cancelScrollAnimation
  ])

  // Alternar Alineación de Texto (Izquierda -> Justificado -> Centrado)
  const cycleTextAlign = useCallback(() => {
    if (!onUpdatePreferences) return
    const current = preferences?.textAlign || 'left'
    let next = 'left'
    let label = 'Alineación: Izquierda'

    if (current === 'left') {
      next = 'justify'
      label = 'Alineación: Justificado (Editorial)'
    } else if (current === 'justify') {
      next = 'center'
      label = 'Alineación: Centrado'
    } else {
      next = 'left'
      label = 'Alineación: Izquierda'
    }

    onUpdatePreferences({ textAlign: next })
    showToast(label)
  }, [preferences?.textAlign, onUpdatePreferences, showToast])

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

      // 12. Ctrl+Shift+Y: Alternar Modo Máquina de Escribir (Typewriter Scrolling)
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        toggleTypewriterMode()
        return
      }

      // 13. Ctrl+Shift+J: Alternar Alineación / Justificado
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        cycleTextAlign()
        return
      }

      // 14. Ctrl+Shift+C: Mostrar / Ocultar estadísticas HUD
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setShowStatsHud((prev) => !prev)
        return
      }

      // 15. Ctrl+= / Ctrl++: Aumentar tamaño de fuente
      if (isCtrlOrMeta && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        adjustFontSize(1)
        return
      }

      // 16. Ctrl+-: Disminuir tamaño de fuente
      if (isCtrlOrMeta && (e.key === '-' || e.key === '_')) {
        e.preventDefault()
        adjustFontSize(-1)
        return
      }

      // 17. Ctrl+0: Restablecer tamaño de fuente
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
    toggleTypewriterMode,
    cycleTextAlign,
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
            className={`btn-icon-sober ${preferences?.typewriterMode ? 'active' : ''}`}
            onClick={toggleTypewriterMode}
            title={`Modo Máquina de Escribir (Ctrl+Shift+Y) - ${preferences?.typewriterMode ? 'Activo (Línea centrada)' : 'Desactivado'}`}
            aria-label="Alternar modo máquina de escribir"
          >
            <TypewriterIcon size={16} />
          </button>

          <button
            className={`btn-icon-sober ${preferences?.textAlign === 'justify' ? 'active' : ''}`}
            onClick={cycleTextAlign}
            title={`Alineación de texto (Ctrl+Shift+J): ${preferences?.textAlign === 'justify' ? 'Justificado' : preferences?.textAlign === 'center' ? 'Centrado' : 'Izquierda'}`}
            aria-label="Alternar alineación del texto"
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
              className={`zen-pill-btn zen-pill-icon-only ${preferences?.typewriterMode ? 'active' : ''}`}
              onClick={toggleTypewriterMode}
              title="Modo Máquina de Escribir (Ctrl+Shift+Y)"
              aria-label="Modo Máquina de Escribir"
            >
              <TypewriterIcon size={15} />
            </button>
            <button
              className="zen-pill-btn zen-pill-icon-only"
              onClick={cycleTextAlign}
              title="Alternar alineación (Ctrl+Shift+J)"
              aria-label="Alternar alineación"
            >
              <AlignJustifyIcon size={15} />
            </button>
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
              <h3 className="zen-stats-title">Estadísticas del Manuscrito</h3>
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

              {/* Sección Modo Zen y Escritura */}
              <section className="shortcuts-section">
                <h4 className="shortcuts-section-title">Modo Zen y Escritura</h4>
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
                    <span className="shortcut-desc">
                      Alternar Modo Máquina de Escribir (Typewriter)
                    </span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd>
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
                    <span className="shortcut-desc">Alternar Modo (Claro / Oscuro)</span>
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
                    <span className="shortcut-desc">
                      Alternar Alineación (Izquierda / Justificado / Centrado)
                    </span>
                    <div className="shortcut-keys">
                      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd>
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
        <main className="editor-main" ref={scrollContainerRef} onClick={handleCanvasClick}>
          <div
            className={`editor-canvas ${preferences?.typewriterMode ? `typewriter-mode-active typewriter-pos-${preferences?.typewriterPosition || 'center'}` : ''}`}
            onClick={handleCanvasClick}
          >
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
