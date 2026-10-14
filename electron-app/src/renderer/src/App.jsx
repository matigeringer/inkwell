import { useState, useEffect, useCallback } from 'react'
import Editor from './components/Editor'
import ProfileModal from './components/ProfileModal'
import FileTree from './components/FileTree'
import {
  PlusIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  FolderIcon,
  FileTextIcon
} from './components/Icons'
import { getTranslation } from './i18n'

function App() {
  const [view, setView] = useState('home') // 'home' | 'editor'
  const [activeDoc, setActiveDoc] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [openedFolder, setOpenedFolder] = useState(null)

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

        let theme = 'puro'
        if (parsed.theme === 'gaceta') {
          theme = 'gaceta'
        } else if (parsed.theme === 'puro' || parsed.theme === 'galera') {
          theme = 'puro'
        }

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

  // Recuperar última carpeta de trabajo guardada al inicio
  useEffect(() => {
    const lastFolder = localStorage.getItem('fountain_last_folder')
    if (lastFolder && window.api?.readFolderTree) {
      window.api
        .readFolderTree(lastFolder)
        .then((res) => {
          if (res && res.success) {
            setOpenedFolder({
              path: res.folderPath,
              name: res.folderName,
              tree: res.tree
            })
          } else {
            localStorage.removeItem('fountain_last_folder')
          }
        })
        .catch(() => {
          localStorage.removeItem('fountain_last_folder')
        })
    }
  }, [])

  // Sincronizar tema, modo, idioma, corrector y variables CSS en el DOM
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

    // 1. Aplicar Tema y Modo efectivo al DOM
    const applyThemeAndMode = (theme, mode) => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const effectiveMode = mode === 'system' ? (isSystemDark ? 'dark' : 'light') : mode
      const safeTheme = theme === 'gaceta' ? 'gaceta' : 'puro'
      const dataThemeValue = `${safeTheme}-${effectiveMode}`
      root.setAttribute('data-theme', dataThemeValue)
    }

    applyThemeAndMode(preferences.theme, preferences.mode)

    // Listener para cambios de tema en el sistema si el modo está en 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (preferences.mode === 'system') {
        applyThemeAndMode(preferences.theme, 'system')
      }
    }
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    // 2. Aplicar fuente del editor
    let fontValue = 'var(--font-serif)'
    if (preferences.fontFamily === 'sans') fontValue = 'var(--font-ui)'
    if (preferences.fontFamily === 'mono') fontValue = 'var(--font-mono)'
    root.style.setProperty('--font-editor', fontValue)

    // 3. Aplicar tamaño de fuente del editor
    root.style.setProperty('--font-size-editor', preferences.fontSize || '1.40rem')

    // 4. Aplicar alineación de texto del editor
    root.style.setProperty('--text-align-editor', preferences.textAlign || 'left')

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [preferences])

  const handleUpdatePreferences = (updates) => {
    setPreferences((prev) => ({ ...prev, ...updates }))
  }

  // Alternar modo rápido (Claro <-> Oscuro) dentro del tema activo sin cambiar nunca el tema
  const handleQuickThemeToggle = () => {
    setPreferences((prev) => {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const currentEffectiveMode =
        prev.mode === 'system' ? (isSystemDark ? 'dark' : 'light') : prev.mode
      const nextMode = currentEffectiveMode === 'dark' ? 'light' : 'dark'
      return { ...prev, mode: nextMode }
    })
  }

  // Alternar idioma rápido (ES <-> EN)
  const handleQuickLanguageToggle = () => {
    setPreferences((prev) => {
      const nextLang = prev.language === 'en' ? 'es' : 'en'
      return { ...prev, language: nextLang }
    })
  }

  const handleCreate = useCallback(() => {
    const defaultDocName = preferences.language === 'en' ? 'document.md' : 'documento.md'
    setActiveDoc({
      id: Date.now().toString(),
      fileName: defaultDocName,
      filePath: null,
      content: ''
    })
    setView('editor')
  }, [preferences.language])

  // Abrir carpeta de trabajo
  const handleOpenFolder = useCallback(async () => {
    if (!window.api?.openFolder) return
    try {
      const res = await window.api.openFolder()
      if (res && res.success) {
        setOpenedFolder({
          path: res.folderPath,
          name: res.folderName,
          tree: res.tree
        })
        localStorage.setItem('fountain_last_folder', res.folderPath)
      }
    } catch (err) {
      console.error('Error al abrir carpeta:', err)
    }
  }, [])

  // Actualizar árbol de archivos
  const handleRefreshFolderTree = async () => {
    if (!openedFolder?.path || !window.api?.readFolderTree) return
    try {
      const res = await window.api.readFolderTree(openedFolder.path)
      if (res && res.success) {
        setOpenedFolder({
          path: res.folderPath,
          name: res.folderName,
          tree: res.tree
        })
      }
    } catch (err) {
      console.error('Error al actualizar árbol de carpeta:', err)
    }
  }

  // Cerrar carpeta de trabajo actual
  const handleCloseFolder = () => {
    setOpenedFolder(null)
    localStorage.removeItem('fountain_last_folder')
  }

  // Abrir archivo individual directamente
  const handleOpenFile = useCallback(async () => {
    if (!window.api?.openFileDialog) return
    try {
      const res = await window.api.openFileDialog()
      if (res && res.success) {
        setActiveDoc({
          id: Date.now().toString(),
          fileName: res.fileName,
          filePath: res.filePath,
          content: res.content
        })
        setView('editor')
      }
    } catch (err) {
      console.error('Error al abrir archivo:', err)
    }
  }, [])

  // Seleccionar archivo desde el árbol
  const handleSelectFile = useCallback(async (filePath) => {
    if (!window.api?.readFile) return
    try {
      const res = await window.api.readFile(filePath)
      if (res && res.success) {
        setActiveDoc({
          id: Date.now().toString(),
          fileName: res.fileName,
          filePath: res.filePath,
          content: res.content
        })
        setView('editor')
      }
    } catch (err) {
      console.error('Error al abrir archivo seleccionado:', err)
    }
  }, [])

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

  if (view === 'editor') {
    return (
      <>
        <Editor
          key={activeDoc?.id || activeDoc?.filePath || 'doc'}
          initialDoc={activeDoc}
          onBack={handleBackToHome}
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
          onOpenProfile={handleOpenProfile}
          openedFolder={openedFolder}
          onRefreshFolderTree={handleRefreshFolderTree}
          onCloseFolder={handleCloseFolder}
          onOpenFolder={handleOpenFolder}
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

          {/* Explorador de archivos si hay carpeta abierta en la pantalla principal */}
          <div className="sidebar-section-label">
            <span className="label-caps">{t.sidebar.manuscripts}</span>
          </div>
          {openedFolder ? (
            <div className="sidebar-tree-section">
              <FileTree
                openedFolder={openedFolder}
                activeFilePath={null}
                onSelectFile={handleSelectFile}
                onRefreshTree={handleRefreshFolderTree}
                onCloseFolder={handleCloseFolder}
                language={preferences.language}
              />
            </div>
          ) : (
            <p className="sidebar-workspace-hint">{t.sidebar.workspaceHint}</p>
          )}
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
