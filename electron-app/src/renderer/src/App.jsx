import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import Editor from './components/Editor'
import ProfileModal from './components/ProfileModal'
import FileTree from './components/FileTree'
import ManuscriptsZone from './components/ManuscriptsZone'
import {
  PlusIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  FolderIcon,
  FileTextIcon
} from './components/Icons'
import { getTranslation } from './i18n'

function findFirstFileInTree(items) {
  if (!Array.isArray(items)) return null
  for (const item of items) {
    if (!item.isDirectory && item.path) {
      return item
    }
    if (item.isDirectory && Array.isArray(item.children)) {
      const found = findFirstFileInTree(item.children)
      if (found) return found
    }
  }
  return null
}

function fileExistsInTree(items, targetPath) {
  if (!Array.isArray(items) || !targetPath) return false
  for (const item of items) {
    if (!item.isDirectory && item.path === targetPath) return true
    if (item.isDirectory && Array.isArray(item.children)) {
      if (fileExistsInTree(item.children, targetPath)) return true
    }
  }
  return false
}

function folderContainsFile(folderPath, filePath) {
  if (!folderPath || !filePath) return false
  const folder = folderPath.replace(/\\/g, '/').replace(/\/+$/, '')
  return filePath.replace(/\\/g, '/').startsWith(`${folder}/`)
}

function App() {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef(null)

  useEffect(() => {
    if (!showAddMenu) return
    const handleOutsideClick = (event) => {
      if (!addMenuRef.current?.contains(event.target)) setShowAddMenu(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowAddMenu(false)
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showAddMenu])
  const [view, setView] = useState('home') // 'home' | 'editor'
  const [activeDoc, setActiveDoc] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [openedFolders, setOpenedFolders] = useState([])
  const [looseFiles, setLooseFiles] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fountain_loose_files') || '[]')
      return Array.isArray(saved) ? saved.filter((path) => typeof path === 'string' && path) : []
    } catch {
      return []
    }
  })
  const [looseFileError, setLooseFileError] = useState(null)

  useEffect(() => {
    localStorage.setItem('fountain_loose_files', JSON.stringify(looseFiles))
  }, [looseFiles])

  const rememberLooseFile = useCallback((path) => {
    if (path) setLooseFiles((files) => files.includes(path) ? files : [...files, path])
  }, [])
  const [activeFolderPath, setActiveFolderPath] = useState(null)
  const [lastFileByFolder, setLastFileByFolder] = useState({})

  // Preferencias con persistencia en localStorage
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('fountain_preferences')
      if (saved) {
        const parsed = JSON.parse(saved)
        let mode = parsed.mode || 'light'

        if (parsed.theme === 'dark') {
          mode = 'dark'
        } else if (parsed.theme === 'light') {
          mode = 'light'
        }

        const theme = 'puro'

        return {
          theme,
          mode: ['light', 'dark', 'system'].includes(mode) ? mode : 'light',
          fontFamily: parsed.fontFamily || 'serif',
          fontSize: parsed.fontSize || '1.40rem',
          textAlign: parsed.textAlign || 'left',
          typewriterMode: Boolean(parsed.typewriterMode),
          typewriterPosition: parsed.typewriterPosition === 'eye' ? 'eye' : 'center',
          typewriterBehavior: parsed.typewriterBehavior === 'strict' ? 'strict' : 'deadzone',
          language: parsed.language === 'en' ? 'en' : 'es',
          spellcheckEnabled: parsed.spellcheckEnabled !== false,
          autoSaveEnabled: parsed.autoSaveEnabled !== false,
          autoSaveDelay: Number(parsed.autoSaveDelay) || 2500,
          historyEnabled: parsed.historyEnabled !== false,
          historyMaxEntries: Number(parsed.historyMaxEntries) || 50,
          historySnapshotInterval: Number(parsed.historySnapshotInterval) || 120000,
          zenShowToolbar: parsed.zenShowToolbar !== false,
          zenShowStats: parsed.zenShowStats !== false,
          zenShowFolder: parsed.zenShowFolder !== false
        }
      }
    } catch {
      // Ignorar error de parsing
    }
    return {
      theme: 'puro',
      mode: 'light', // 'light' | 'dark' | 'system'
      fontFamily: 'serif', // 'serif' | 'sans' | 'mono'
      fontSize: '1.40rem',
      textAlign: 'left', // 'left' | 'justify' | 'center'
      typewriterMode: false, // boolean: centrado vertical continuo
      typewriterPosition: 'center', // 'center' (50% medio) | 'eye' (38% tercio superior / línea de ojos)
      typewriterBehavior: 'deadzone', // 'deadzone' | 'strict'
      language: 'es', // 'es' | 'en'
      spellcheckEnabled: true, // boolean: corrector ortográfico activo
      autoSaveEnabled: true, // boolean: guardado automático tras pausa
      autoSaveDelay: 2500, // ms: tiempo de inactividad para auto-guardar
      historyEnabled: true, // boolean: instantáneas de historial temporal activas
      historyMaxEntries: 50, // número de versiones retenidas por documento
      historySnapshotInterval: 120000, // ms: intervalo mínimo entre snapshots automáticas (2 min)
      zenShowToolbar: true, // boolean: barra de herramientas flotante en modo zen
      zenShowStats: true, // boolean: barra de estadísticas flotante en modo zen
      zenShowFolder: true // boolean: navegador de carpetas flotante en modo zen
    }
  })

  const [profileInitialTab, setProfileInitialTab] = useState('general')

  const handleOpenProfile = (tab = 'general') => {
    setProfileInitialTab(tab)
    setIsProfileOpen(true)
  }

  const currentLang = preferences.language || 'es'
  const t = getTranslation(currentLang)

  // Recuperar carpetas de trabajo guardadas al inicio
  useEffect(() => {
    if (!window.api?.readFolderTree) return

    let savedPaths = []
    try {
      const savedList = localStorage.getItem('fountain_opened_folders')
      if (savedList) {
        const parsed = JSON.parse(savedList)
        if (Array.isArray(parsed)) {
          savedPaths = parsed.filter(Boolean)
        }
      }
    } catch {}

    if (savedPaths.length === 0) {
      const legacyLast = localStorage.getItem('fountain_last_folder')
      if (legacyLast) {
        savedPaths = [legacyLast]
      }
    }

    if (savedPaths.length === 0) return

    const savedActive = localStorage.getItem('fountain_active_folder')

    Promise.all(
      savedPaths.map((folderPath) =>
        window.api
          .readFolderTree(folderPath)
          .then((res) =>
            res && res.success
              ? {
                  path: res.folderPath,
                  name: res.folderName,
                  tree: res.tree
                }
              : null
          )
          .catch(() => null)
      )
    ).then((results) => {
      const validFolders = results.filter(Boolean)
      setOpenedFolders(validFolders)
      if (validFolders.length > 0) {
        const activeMatch = validFolders.find((f) => f.path === savedActive)
        setActiveFolderPath(activeMatch ? activeMatch.path : validFolders[0].path)
        localStorage.setItem(
          'fountain_opened_folders',
          JSON.stringify(validFolders.map((f) => f.path))
        )
      } else {
        localStorage.removeItem('fountain_opened_folders')
        localStorage.removeItem('fountain_last_folder')
        localStorage.removeItem('fountain_active_folder')
      }
    })
  }, [])

  // Ejecutar cambios de tema con View Transitions API sincronizada
  const withThemeTransition = useCallback((callback) => {
    if (
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.startViewTransition(() => {
        flushSync(callback)
      })
    } else {
      callback()
    }
  }, [])

  // 1. Sincronizar tema, modo y variables tipográficas en el DOM antes del pintado
  useLayoutEffect(() => {
    const root = document.documentElement

    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveMode =
      preferences.mode === 'system' ? (isSystemDark ? 'dark' : 'light') : preferences.mode
    const safeTheme = 'puro'
    const dataThemeValue = `${safeTheme}-${effectiveMode}`
    root.setAttribute('data-theme', dataThemeValue)
    window.api?.setWindowTheme?.(preferences.mode)

    // Aplicar fuente del editor
    let fontValue = 'var(--font-serif)'
    if (preferences.fontFamily === 'sans') fontValue = 'var(--font-ui)'
    if (preferences.fontFamily === 'mono') fontValue = 'var(--font-mono)'
    root.style.setProperty('--font-editor', fontValue)

    // Aplicar tamaño de fuente del editor
    root.style.setProperty('--font-size-editor', preferences.fontSize || '1.40rem')

    // Aplicar alineación de texto del editor
    root.style.setProperty('--text-align-editor', preferences.textAlign || 'left')
  }, [
    preferences.theme,
    preferences.mode,
    preferences.fontFamily,
    preferences.fontSize,
    preferences.textAlign
  ])

  // Sincronizar persistencia, idioma, corrector y listener de tema del sistema
  useEffect(() => {
    try {
      localStorage.setItem('fountain_preferences', JSON.stringify(preferences))
    } catch {
      // Ignorar error de almacenamiento
    }

    const root = document.documentElement

    // Sincronizar atributo de idioma en HTML
    root.setAttribute('lang', preferences.language || 'es')

    // Sincronizar configuración con el proceso principal de Electron (SpellChecker y Diálogos)
    if (window.api?.setSpellCheckerConfig) {
      window.api
        .setSpellCheckerConfig({
          language: preferences.language || 'es',
          enabled: preferences.spellcheckEnabled !== false
        })
        .catch((err) => {
          console.error('Error al sincronizar spellcheck con Electron:', err)
        })
    }

    // Listener para cambios de tema en el sistema si el modo está en 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (preferences.mode === 'system') {
        withThemeTransition(() => {
          const rootEl = document.documentElement
          const isSystemDark = mediaQuery.matches
          const effectiveMode = isSystemDark ? 'dark' : 'light'
          const safeTheme = 'puro'
          rootEl.setAttribute('data-theme', `${safeTheme}-${effectiveMode}`)
          window.api?.setWindowTheme?.('system')
        })
      }
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [preferences, withThemeTransition])

  const handleUpdatePreferences = useCallback(
    (updates) => {
      const isThemeChange =
        (updates.mode !== undefined && updates.mode !== preferences.mode) ||
        (updates.theme !== undefined && updates.theme !== preferences.theme)

      if (isThemeChange) {
        withThemeTransition(() => {
          setPreferences((prev) => ({ ...prev, ...updates }))
        })
      } else {
        setPreferences((prev) => ({ ...prev, ...updates }))
      }
    },
    [preferences.mode, preferences.theme, withThemeTransition]
  )

  // Alternar modo rápido (Claro <-> Oscuro) dentro del tema activo sin cambiar nunca el tema
  const handleQuickThemeToggle = useCallback(() => {
    withThemeTransition(() => {
      setPreferences((prev) => {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const currentEffectiveMode =
          prev.mode === 'system' ? (isSystemDark ? 'dark' : 'light') : prev.mode
        const nextMode = currentEffectiveMode === 'dark' ? 'light' : 'dark'
        return { ...prev, mode: nextMode }
      })
    })
  }, [withThemeTransition])

  // Alternar idioma rápido (ES <-> EN)
  const handleQuickLanguageToggle = () => {
    setPreferences((prev) => {
      const nextLang = prev.language === 'en' ? 'es' : 'en'
      return { ...prev, language: nextLang }
    })
  }

  useEffect(() => {
    if (activeFolderPath) {
      try {
        localStorage.setItem('fountain_active_folder', activeFolderPath)
      } catch {}
    } else {
      localStorage.removeItem('fountain_active_folder')
    }
  }, [activeFolderPath])

  const handleCreate = useCallback(() => {
    const defaultDocName = preferences.language === 'en' ? 'document.md' : 'documento.md'
    const newId = Date.now().toString()
    setActiveDoc({
      id: newId,
      fileName: defaultDocName,
      filePath: null,
      content: ''
    })
    setActiveFolderPath(null)
    setView('editor')
  }, [preferences.language])

  // Abrir carpeta de trabajo (añade la carpeta a la lista de manuscritos abiertos)
  const handleOpenFolder = useCallback(async () => {
    if (!window.api?.openFolder) return null
    try {
      const res = await window.api.openFolder()
      if (res && res.success) {
        const folderObj = {
          path: res.folderPath,
          name: res.folderName,
          tree: res.tree
        }
        setOpenedFolders((prev) => {
          const exists = prev.some((f) => f.path === res.folderPath)
          const next = exists
            ? prev.map((f) => (f.path === res.folderPath ? folderObj : f))
            : [...prev, folderObj]
          try {
            localStorage.setItem(
              'fountain_opened_folders',
              JSON.stringify(next.map((f) => f.path))
            )
            localStorage.setItem('fountain_last_folder', res.folderPath)
          } catch {}
          return next
        })
        setActiveFolderPath(res.folderPath)
        return folderObj
      }
    } catch (err) {
      console.error('Error al abrir carpeta:', err)
    }
    return null
  }, [])

  // Actualizar árbol de archivos de una carpeta específica o de todas las abiertas
  const handleRefreshFolderTree = useCallback(
    async (targetFolderPath = null) => {
      if (!window.api?.readFolderTree) return
      const pathsToRefresh = targetFolderPath
        ? [targetFolderPath]
        : openedFolders.map((f) => f.path)
      if (pathsToRefresh.length === 0) return

      try {
        const results = await Promise.all(
          pathsToRefresh.map((fp) =>
            window.api
              .readFolderTree(fp)
              .then((res) =>
                res && res.success
                  ? { path: res.folderPath, name: res.folderName, tree: res.tree }
                  : null
              )
              .catch(() => null)
          )
        )
        const updatedMap = new Map()
        results.filter(Boolean).forEach((f) => updatedMap.set(f.path, f))

        if (updatedMap.size > 0) {
          setOpenedFolders((prev) =>
            prev.map((f) => (updatedMap.has(f.path) ? updatedMap.get(f.path) : f))
          )
        }
      } catch (err) {
        console.error('Error al actualizar árbol de carpeta:', err)
      }
    },
    [openedFolders]
  )

  // Cerrar una carpeta de trabajo específica
  const handleCloseFolder = useCallback(
    (targetFolderPath = null) => {
      const pathToClose = targetFolderPath || activeFolderPath
      if (!pathToClose) return

      setOpenedFolders((prev) => {
        const idx = prev.findIndex((f) => f.path === pathToClose)
        if (idx === -1) return prev
        const next = prev.filter((f) => f.path !== pathToClose)
        try {
          if (next.length > 0) {
            localStorage.setItem(
              'fountain_opened_folders',
              JSON.stringify(next.map((f) => f.path))
            )
            localStorage.setItem('fountain_last_folder', next[next.length - 1].path)
          } else {
            localStorage.removeItem('fountain_opened_folders')
            localStorage.removeItem('fountain_last_folder')
          }
        } catch {}

        if (activeFolderPath === pathToClose) {
          if (next.length > 0) {
            const nextIdx = Math.min(idx, next.length - 1)
            setActiveFolderPath(next[nextIdx].path)
          } else {
            setActiveFolderPath(null)
          }
        }
        return next
      })
    },
    [activeFolderPath]
  )

  // Abrir archivo individual directamente
  const handleOpenFile = useCallback(async () => {
    if (!window.api?.openFileDialog) return
    try {
      const res = await window.api.openFileDialog()
      if (res && res.success) {
        setActiveDoc({
          id: res.filePath || Date.now().toString(),
          fileName: res.fileName,
          filePath: res.filePath,
          content: res.content
        })
        const matchingFolder = openedFolders.find(
          (f) => folderContainsFile(f.path, res.filePath)
        )
        if (matchingFolder) {
          setActiveFolderPath(matchingFolder.path)
          setLastFileByFolder((prev) => ({ ...prev, [matchingFolder.path]: res.filePath }))
        } else {
          setActiveFolderPath(null)
          rememberLooseFile(res.filePath)
        }
        setLooseFileError(null)
        setView('editor')
      }
    } catch (err) {
      console.error('Error al abrir archivo:', err)
    }
  }, [openedFolders, rememberLooseFile])

  // Seleccionar archivo desde el árbol o Zen
  const handleSelectFile = useCallback(
    async (filePath, folderPath = null) => {
      if (!window.api?.readFile) return
      try {
        const res = await window.api.readFile(filePath)
        if (res && res.success) {
          setActiveDoc({
            id: res.filePath || Date.now().toString(),
            fileName: res.fileName,
            filePath: res.filePath,
            content: res.content
          })
          const ownerFolder =
            (folderPath && openedFolders.find((f) => f.path === folderPath)) ||
            openedFolders.find((f) => folderContainsFile(f.path, res.filePath))
          if (ownerFolder) {
            setActiveFolderPath(ownerFolder.path)
            setLastFileByFolder((prev) => ({ ...prev, [ownerFolder.path]: res.filePath }))
          } else {
            setActiveFolderPath(null)
            rememberLooseFile(res.filePath)
          }
          setLooseFileError(null)
          setView('editor')
          return true
        } else {
          setLooseFileError(filePath)
          return false
        }
      } catch (err) {
        setLooseFileError(filePath)
        console.error('Error al abrir archivo seleccionado:', err)
        return false
      }
    },
    [openedFolders, rememberLooseFile]
  )

  // Cambiar carpeta/manuscrito activo desde el desplegable del editor
  const handleSwitchFolder = useCallback(
    async (targetFolderPath, newFolder = null) => {
      const targetFolder = newFolder || openedFolders.find((f) => f.path === targetFolderPath)
      if (!targetFolder) return

      setActiveFolderPath(targetFolder.path)

      // Si el archivo actual ya pertenece a esta carpeta, no hace falta recargar otro
      if (activeDoc?.filePath && folderContainsFile(targetFolder.path, activeDoc.filePath)) {
        return
      }

      // Buscar último archivo editado en esta carpeta o el primer archivo disponible
      const rememberedPath = lastFileByFolder[targetFolder.path]
      let fileToOpen = null
      if (rememberedPath && fileExistsInTree(targetFolder.tree, rememberedPath)) {
        fileToOpen = rememberedPath
      } else {
        const firstFile = findFirstFileInTree(targetFolder.tree)
        if (firstFile?.path) {
          fileToOpen = firstFile.path
        }
      }

      if (fileToOpen && window.api?.readFile) {
        try {
          const res = await window.api.readFile(fileToOpen)
          if (res && res.success) {
            setActiveDoc({
              id: res.filePath || Date.now().toString(),
              fileName: res.fileName,
              filePath: res.filePath,
              content: res.content
            })
            setLastFileByFolder((prev) => ({ ...prev, [targetFolder.path]: res.filePath }))
          }
        } catch (err) {
          console.error('Error al cambiar al archivo del manuscrito:', err)
        }
      }
    },
    [openedFolders, activeDoc?.filePath, lastFileByFolder]
  )

  const handleBackToHome = () => {
    setView('home')
  }

  // Atajos globales de la aplicación
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Ctrl+N: Nuevo documento
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 'n' || e.key === 'N') && view === 'home') {
        e.preventDefault()
        handleCreate()
        return
      }

      // Ctrl+O: Abrir archivo
      if (isCtrlOrMeta && !e.shiftKey && (e.key === 'o' || e.key === 'O') && view === 'home') {
        e.preventDefault()
        handleOpenFile()
        return
      }

      // Ctrl+Shift+O: Abrir carpeta
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'o' || e.key === 'O') && view === 'home') {
        e.preventDefault()
        handleOpenFolder()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, handleCreate, handleOpenFile, handleOpenFolder])

  // Calcular modo efectivo para la interfaz
  const isSystemDark =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  const effectiveMode =
    preferences.mode === 'system' ? (isSystemDark ? 'dark' : 'light') : preferences.mode
  const isEffectiveDark = effectiveMode === 'dark'

  const activeFolder = activeFolderPath
    ? openedFolders.find((f) => f.path === activeFolderPath) || null
    : null

  if (view === 'editor') {
    return (
      <>
        <Editor
          key={activeDoc?.id || 'doc'}
          initialDoc={activeDoc}
          onSelectFile={handleSelectFile}
          onBack={handleBackToHome}
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
          onOpenProfile={handleOpenProfile}
          openedFolder={activeFolder}
          openedFolders={openedFolders}
          looseFiles={looseFiles}
          onSavedFile={(path, name, content) => {
            setActiveDoc((doc) => ({ ...doc, filePath: path, fileName: name, content }))
            if (!openedFolders.some((folder) => folderContainsFile(folder.path, path))) rememberLooseFile(path)
          }}
          onSwitchFolder={handleSwitchFolder}
          onRefreshFolderTree={handleRefreshFolderTree}
          onCloseFolder={handleCloseFolder}
          onOpenFolder={handleOpenFolder}
          onNewDoc={handleCreate}
        />
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
          initialTab={profileInitialTab}
        />
      </>
    )
  }

  return (
    <div className="app-container">
      {/* Barra lateral */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-section">
            <div className="brand-header">
              <h1 className="app-title">{t.common.appName}</h1>
            </div>
            <hr className="brand-rule" />
          </div>

          {/* Zona de manuscritos: se scrollea solo cuando los manuscritos abiertos superan la pantalla */}
          <div className="sidebar-manuscripts-wrapper">
            <div className="sidebar-section-label">
              <span className="label-caps">{t.sidebar.manuscripts}</span>
              <div className="sidebar-add-wrap" ref={addMenuRef}>
                <button type="button" className="btn-sidebar-add-folder" onClick={() => setShowAddMenu((open) => !open)} aria-label={currentLang === 'en' ? 'Add file or folder' : 'Añadir archivo o carpeta'} aria-expanded={showAddMenu}>
                  <PlusIcon size={13} />
                </button>
                {showAddMenu && <div className="sidebar-add-menu">
                  <button type="button" onClick={() => { setShowAddMenu(false); handleOpenFile() }}>{t.home.openFile}</button>
                  <button type="button" onClick={() => { setShowAddMenu(false); handleOpenFolder() }}>{t.home.openFolder}</button>
                </div>}
              </div>
            </div>
            <ManuscriptsZone
              openedFolders={openedFolders}
              looseFiles={looseFiles}
              looseFileError={looseFileError}
              onRemoveLooseFile={(path) => {
                setLooseFiles((files) => files.filter((file) => file !== path))
                setLooseFileError((error) => error === path ? null : error)
              }}
              activeFilePath={activeDoc?.filePath || null}
              onSelectFile={handleSelectFile}
              onRefreshFolderTree={handleRefreshFolderTree}
              onCloseFolder={handleCloseFolder}
              language={preferences.language}
            />
          </div>
        </div>

        {/* Pie de la barra lateral con preferencias, selector de idioma y tema */}
        <div className="sidebar-footer">
          <div className="sidebar-settings-bar">
            <button
              className="sidebar-settings-btn"
              onClick={() => handleOpenProfile('general')}
              type="button"
              title={t.sidebar.preferencesTitle}
            >
              <SettingsIcon size={16} />
              <span>{t.sidebar.preferences}</span>
            </button>

            <button
              className="btn-quick-theme"
              onClick={handleQuickLanguageToggle}
              type="button"
              title={t.sidebar.switchLanguageTitle}
              aria-label="Switch language"
              style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em' }}
            >
              {currentLang.toUpperCase()}
            </button>

            <button
              className="btn-quick-theme"
              onClick={handleQuickThemeToggle}
              type="button"
              title={t.sidebar.themeToggleTitle(isEffectiveDark, preferences.mode === 'system')}
              aria-label={t.sidebar.themeToggleAria}
            >
              {isEffectiveDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal (Portadilla de bienvenida) */}
      <main className="main-content">
        <div className="welcome-hero">
          <div className="welcome-brand">
            <h2 className="welcome-heading">
              {t.home.welcomeTitle} <em>{t.home.welcomeTitleEmphasis}</em>.
            </h2>
            <p className="welcome-subtitle">{t.home.welcomeSubtitle}</p>
          </div>

          <span className="label-caps welcome-index-label">{t.home.contents}</span>
          <div className="welcome-actions">
            <button
              className="welcome-action-card welcome-action-primary"
              onClick={handleCreate}
              type="button"
              title={t.home.newDocTitle}
            >
              <span className="action-index-num">I.</span>
              <span className="action-card-left">
                <PlusIcon size={15} />
                <span>{t.home.newDocument}</span>
              </span>
              <span className="action-leader" aria-hidden="true" />
              <kbd className="action-kbd">{t.home.newDocShortcut}</kbd>
            </button>

            <button
              className="welcome-action-card"
              onClick={handleOpenFile}
              type="button"
              title={t.home.openFileTitle}
            >
              <span className="action-index-num">II.</span>
              <span className="action-card-left">
                <FileTextIcon size={15} />
                <span>{t.home.openFile}</span>
              </span>
              <span className="action-leader" aria-hidden="true" />
              <kbd className="action-kbd">{t.home.openFileShortcut}</kbd>
            </button>

            <button
              className="welcome-action-card"
              onClick={handleOpenFolder}
              type="button"
              title={t.home.openFolderTitle}
            >
              <span className="action-index-num">III.</span>
              <span className="action-card-left">
                <FolderIcon size={15} />
                <span>{t.home.openFolder}</span>
              </span>
              <span className="action-leader" aria-hidden="true" />
              <kbd className="action-kbd">{t.home.openFolderShortcut}</kbd>
            </button>
          </div>
        </div>
      </main>

      {/* Modal de Preferencias */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        initialTab={profileInitialTab}
      />
    </div>
  )
}

export default App
