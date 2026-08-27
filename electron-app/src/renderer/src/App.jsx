import { useState, useEffect } from 'react'
import Editor from './components/Editor'
import ProfileModal from './components/ProfileModal'
import {
  FeatherIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SettingsIcon
} from './components/Icons'

function App() {
  const [view, setView] = useState('home') // 'home' | 'editor'
  const [activeDoc, setActiveDoc] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

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
      fontSize: '1.40rem'
    }
  })

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

  const handleBackToHome = () => {
    setView('home')
  }

  // Atajo global Ctrl+N / Cmd+N para crear nuevo documento
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && view === 'home') {
        e.preventDefault()
        handleCreate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view])

  if (view === 'editor') {
    return (
      <>
        <Editor
          initialDoc={activeDoc}
          onBack={handleBackToHome}
          preferences={preferences}
          onOpenProfile={() => setIsProfileOpen(true)}
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
          </div>
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
