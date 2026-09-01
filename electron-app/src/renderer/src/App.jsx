import { useState, useEffect, useCallback } from 'react'
import Editor from './components/Editor'
import ProfileModal from './components/ProfileModal'
import FileTree from './components/FileTree'
import {
  FeatherIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SettingsIcon,
  FolderIcon,
  FileTextIcon
} from './components/Icons'

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
        return JSON.parse(saved)
      }
    } catch {
      // Ignorar error de parsing
    }
    return {
      theme: 'light', // 'light' | 'dark' | 'system'
      fontFamily: 'serif', // 'serif' | 'sans' | 'mono'
      fontSize: '1.40rem',
      textAlign: 'left', // 'left' | 'justify' | 'center'
      typewriterMode: false // boolean: centrado vertical continuo
    }
  })

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

  // Sincronizar tema y variables CSS en el DOM
  useEffect(() => {
    try {
      localStorage.setItem('fountain_preferences', JSON.stringify(preferences))
    } catch {
      // Ignorar error de almacenamiento
    }

    const root = document.documentElement

    // 1. Aplicar Tema (Claro / Oscuro / Sistema)
    const applyTheme = (theme) => {
      if (theme === 'system') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', isSystemDark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', theme)
      }
    }

    applyTheme(preferences.theme)

    // Listener para cambios de tema en el sistema si está en 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => {
      if (preferences.theme === 'system') {
        applyTheme('system')
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

  // Alternar tema rápido entre claro y oscuro
  const handleQuickThemeToggle = () => {
    setPreferences((prev) => {
      const nextTheme = prev.theme === 'dark' ? 'light' : 'dark'
      return { ...prev, theme: nextTheme }
    })
  }

  const handleCreate = () => {
    setActiveDoc({
      id: Date.now().toString(),
      fileName: 'documento.md',
      filePath: null,
      content: ''
    })
    setView('editor')
  }

  // Abrir carpeta de trabajo
  const handleOpenFolder = async () => {
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
  }

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
  const handleOpenFile = async () => {
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
  }

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
  }, [view])

  if (view === 'editor') {
    return (
      <>
        <Editor
          key={activeDoc?.id || activeDoc?.filePath || 'doc'}
          initialDoc={activeDoc}
          onBack={handleBackToHome}
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
          onOpenProfile={() => setIsProfileOpen(true)}
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
              <div className="brand-logo-badge">
                <FeatherIcon size={20} className="brand-feather" />
              </div>
              <div className="brand-texts">
                <h1 className="app-title">Fountain</h1>
              </div>
            </div>
          </div>

          <div className="sidebar-actions">
            <button
              className="btn-sidebar-create"
              onClick={handleCreate}
              type="button"
              title="Crear nuevo documento (Ctrl+N)"
            >
              <PlusIcon size={16} />
              <span>Nuevo documento</span>
              <kbd className="sidebar-kbd">Ctrl+N</kbd>
            </button>

            <button
              className="btn-sidebar-secondary"
              onClick={handleOpenFile}
              type="button"
              title="Abrir archivo Markdown existente (Ctrl+O)"
            >
              <FileTextIcon size={15} />
              <span>Abrir archivo...</span>
              <kbd className="sidebar-kbd">Ctrl+O</kbd>
            </button>

            <button
              className="btn-sidebar-secondary"
              onClick={handleOpenFolder}
              type="button"
              title="Abrir carpeta con manuscritos (Ctrl+Shift+O)"
            >
              <FolderIcon size={15} />
              <span>Abrir carpeta...</span>
              <kbd className="sidebar-kbd">Ctrl+Shift+O</kbd>
            </button>
          </div>

          {/* Explorador de archivos si hay carpeta abierta en la pantalla principal */}
          {openedFolder ? (
            <div className="sidebar-tree-section">
              <FileTree
                openedFolder={openedFolder}
                activeFilePath={null}
                onSelectFile={handleSelectFile}
                onRefreshTree={handleRefreshFolderTree}
                onCloseFolder={handleCloseFolder}
              />
            </div>
          ) : (
            <div className="sidebar-workspace-hint">
              <span className="hint-label">Organización</span>
              <p className="hint-desc">
                Abre una carpeta para organizar capítulos, borradores y notas en un árbol
                jerárquico.
              </p>
            </div>
          )}
        </div>

        {/* Pie de la barra lateral con preferencias y acceso a temas */}
        <div className="sidebar-footer">
          <div className="sidebar-settings-bar">
            <button
              className="sidebar-settings-btn"
              onClick={() => setIsProfileOpen(true)}
              type="button"
              title="Abrir preferencias de escritura y tema"
            >
              <SettingsIcon size={16} />
              <span>Preferencias</span>
            </button>

            <button
              className="btn-quick-theme"
              onClick={handleQuickThemeToggle}
              type="button"
              title={`Cambiar a modo ${preferences.theme === 'dark' ? 'claro' : 'oscuro'}`}
              aria-label="Cambiar tema"
            >
              {preferences.theme === 'dark' ? (
                <SunIcon size={16} />
              ) : preferences.theme === 'light' ? (
                <MoonIcon size={16} />
              ) : (
                <MonitorIcon size={16} />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal (Lienzo de Bienvenida) */}
      <main className="main-content">
        <div className="welcome-hero">
          <div className="welcome-emblem">
            <FeatherIcon size={38} className="welcome-feather-icon" />
          </div>

          <h2 className="welcome-title">El espacio para tus palabras</h2>
          <p className="welcome-description">
            Un entorno sereno y libre de distracciones diseñado para la concentración, el ensayo y
            la narrativa literaria.
          </p>

          <div className="welcome-actions">
            <button className="btn-hero-create" onClick={handleCreate} type="button">
              <span className="btn-icon">
                <PlusIcon size={18} />
              </span>
              <span>Empezar a escribir</span>
            </button>

            <div className="welcome-secondary-actions">
              <button
                className="btn-hero-secondary"
                onClick={handleOpenFile}
                type="button"
                title="Abrir archivo Markdown existente"
              >
                <FileTextIcon size={16} />
                <span>Abrir archivo</span>
              </button>

              <button
                className="btn-hero-secondary"
                onClick={handleOpenFolder}
                type="button"
                title="Abrir carpeta de trabajo"
              >
                <FolderIcon size={16} />
                <span>Abrir carpeta</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Preferencias */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
      />
    </div>
  )
}

export default App
