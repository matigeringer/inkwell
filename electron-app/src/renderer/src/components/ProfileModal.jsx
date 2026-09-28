import { useState, useEffect } from 'react'
import {
  CloseIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  PaletteIcon,
  TypeIcon,
  CheckIcon,
  TypewriterIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon,
  FeatherIcon
} from './Icons'

export default function ProfileModal({ isOpen, onClose, preferences, onUpdatePreferences }) {
  const [activeTab, setActiveTab] = useState('appearance') // 'appearance' | 'typography' | 'writing'

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const tabs = [
    { id: 'appearance', label: 'Apariencia', icon: PaletteIcon },
    { id: 'typography', label: 'Tipografía', icon: TypeIcon },
    { id: 'writing', label: 'Escritura', icon: FeatherIcon }
  ]

  const themes = [
    {
      id: 'puro',
      name: 'Puro',
      desc: 'Minimalismo contemporáneo en blanco y grafito',
      light: {
        bg: '#ffffff',
        sidebar: '#f6f6f8',
        text: '#121316',
        accent: '#007aff'
      },
      dark: {
        bg: '#1c1c1e',
        sidebar: '#161618',
        text: '#ededed',
        accent: '#38bdf8'
      }
    },
    {
      id: 'sepia',
      name: 'Sepia',
      desc: 'Calidez editorial en tonos lino y espresso',
      light: {
        bg: '#faf7f2',
        sidebar: '#f1ebd8',
        text: '#27231f',
        accent: '#b45309'
      },
      dark: {
        bg: '#1b1613',
        sidebar: '#16120f',
        text: '#f2ebe1',
        accent: '#e07a38'
      }
    }
  ]

  const modes = [
    {
      id: 'light',
      name: 'Claro',
      desc: 'Lienzo iluminado',
      icon: SunIcon
    },
    {
      id: 'dark',
      name: 'Oscuro',
      desc: 'Lienzo atenuado',
      icon: MoonIcon
    },
    {
      id: 'system',
      name: 'Sistema',
      desc: 'Sincronizado con el SO',
      icon: MonitorIcon
    }
  ]

  const fonts = [
    {
      id: 'serif',
      name: 'Newsreader',
      fontClass: 'preview-font-serif',
      example:
        'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.'
    },
    {
      id: 'sans',
      name: 'Plus Jakarta Sans',
      fontClass: 'preview-font-sans',
      example:
        'El pensamiento claro precede a la escritura fluida y directa. Las palabras exactas encuentran su ritmo natural sobre un lienzo silencioso.'
    },
    {
      id: 'mono',
      name: 'JetBrains Mono',
      fontClass: 'preview-font-mono',
      example:
        '01. Hipótesis inicial y estructura técnica del borrador: ritmo constante y precisión en cada línea.'
    }
  ]

  const fontSizes = [
    { id: '1.10rem', label: 'Compacto', note: '1.10rem' },
    { id: '1.40rem', label: 'Estándar', note: '1.40rem' },
    { id: '1.80rem', label: 'Amplio', note: '1.80rem' }
  ]

  const alignments = [
    {
      id: 'left',
      name: 'Izquierda',
      desc: 'Alineación natural',
      icon: AlignLeftIcon
    },
    {
      id: 'justify',
      name: 'Justificado',
      desc: 'Márgenes limpios estilo libro',
      icon: AlignJustifyIcon
    },
    {
      id: 'center',
      name: 'Centrado',
      desc: 'Lírico y dramaturgia',
      icon: AlignCenterIcon
    }
  ]

  const currentFontSize = preferences.fontSize || '1.40rem'
  const currentTextAlign = preferences.textAlign || 'left'
  const currentTypewriter = Boolean(preferences.typewriterMode)
  const currentTypewriterPosition = preferences.typewriterPosition || 'center'
  const currentTypewriterBehavior = preferences.typewriterBehavior || 'deadzone'
  const currentFontFamily =
    preferences.fontFamily === 'sans'
      ? 'var(--font-ui)'
      : preferences.fontFamily === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-serif)'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header-wide">
          <div className="modal-header-title-bar">
            <div>
              <h2 id="modal-title" className="modal-title">
                Preferencias
              </h2>
              <p className="modal-subtitle">Configuración del entorno de escritura</p>
            </div>
            <button
              className="btn-icon-subtle"
              onClick={onClose}
              aria-label="Cerrar modal"
              title="Cerrar (Esc)"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Selector de pestañas segmentadas */}
          <nav className="modal-segmented-nav" aria-label="Secciones de configuración">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`segmented-tab-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </header>

        <div className="modal-body modal-body-wide">
          {/* PESTAÑA: APARIENCIA & TEMAS */}
          {activeTab === 'appearance' && (
            <div className="pref-tab-panel">
              {/* Sección 1: Paleta de Color */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Paleta de Color</h3>
                  <p className="section-desc">
                    Selecciona el estilo visual del lienzo y la interfaz
                  </p>
                </div>

                <div className="theme-grid-palettes">
                  {themes.map((t) => {
                    const isSelected = (preferences.theme || 'puro') === t.id
                    const currentMode = preferences.mode || 'light'

                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`theme-card-preview ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ theme: t.id })}
                      >
                        {/* Mini maqueta visual que se adapta al modo seleccionado */}
                        <div className="theme-mini-mockup">
                          {currentMode === 'system' ? (
                            <div className="mini-mockup-frame mini-mockup-split">
                              {/* Mitad izquierda: Claro */}
                              <div
                                className="mini-mockup-half"
                                style={{ backgroundColor: t.light.bg }}
                              >
                                <div
                                  className="mini-mockup-sidebar"
                                  style={{ backgroundColor: t.light.sidebar }}
                                >
                                  <span
                                    className="mini-mockup-dot"
                                    style={{ backgroundColor: t.light.accent }}
                                  />
                                </div>
                                <div className="mini-mockup-content">
                                  <span
                                    className="mini-line line-primary"
                                    style={{ backgroundColor: t.light.text }}
                                  />
                                  <span
                                    className="mini-line line-secondary"
                                    style={{ backgroundColor: t.light.accent }}
                                  />
                                </div>
                              </div>
                              {/* Mitad derecha: Oscuro */}
                              <div
                                className="mini-mockup-half"
                                style={{
                                  backgroundColor: t.dark.bg,
                                  borderLeft: '1px solid var(--border-subtle)'
                                }}
                              >
                                <div
                                  className="mini-mockup-sidebar"
                                  style={{ backgroundColor: t.dark.sidebar }}
                                >
                                  <span
                                    className="mini-mockup-dot"
                                    style={{ backgroundColor: t.dark.accent }}
                                  />
                                </div>
                                <div className="mini-mockup-content">
                                  <span
                                    className="mini-line line-primary"
                                    style={{ backgroundColor: t.dark.text }}
                                  />
                                  <span
                                    className="mini-line line-secondary"
                                    style={{ backgroundColor: t.dark.accent }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            (() => {
                              const palette = currentMode === 'dark' ? t.dark : t.light
                              return (
                                <div
                                  className="mini-mockup-frame"
                                  style={{ backgroundColor: palette.bg }}
                                >
                                  <div
                                    className="mini-mockup-sidebar"
                                    style={{ backgroundColor: palette.sidebar }}
                                  >
                                    <span
                                      className="mini-mockup-dot"
                                      style={{ backgroundColor: palette.accent }}
                                    />
                                  </div>
                                  <div className="mini-mockup-content">
                                    <span
                                      className="mini-line line-primary"
                                      style={{ backgroundColor: palette.text }}
                                    />
                                    <span
                                      className="mini-line line-secondary"
                                      style={{ backgroundColor: palette.accent }}
                                    />
                                    <span
                                      className="mini-line line-subtle"
                                      style={{ backgroundColor: palette.text }}
                                    />
                                  </div>
                                </div>
                              )
                            })()
                          )}
                        </div>

                        <div className="theme-card-details">
                          <div className="theme-card-name-row">
                            <span className="theme-card-name">{t.name}</span>
                            {isSelected && <CheckIcon size={14} className="theme-check" />}
                          </div>
                          <span className="theme-card-desc">{t.desc}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Sección 2: Modo de Apariencia */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Modo de Apariencia</h3>
                  <p className="section-desc">Selecciona la iluminación para la paleta elegida</p>
                </div>

                <div className="mode-selector-grid">
                  {modes.map((m) => {
                    const ModeIcon = m.icon
                    const isModeSelected = (preferences.mode || 'light') === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`mode-card-btn ${isModeSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ mode: m.id })}
                      >
                        <div className="mode-card-icon">
                          <ModeIcon size={17} />
                        </div>
                        <div className="mode-card-info">
                          <div className="mode-card-name-row">
                            <span className="mode-card-name">{m.name}</span>
                            {isModeSelected && <CheckIcon size={14} className="theme-check" />}
                          </div>
                          <span className="mode-card-desc">{m.desc}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          )}

          {/* PESTAÑA: TIPOGRAFÍA & TAMAÑO */}
          {activeTab === 'typography' && (
            <div className="pref-tab-panel">
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Familia Tipográfica</h3>
                  <p className="section-desc">Diseño de letra para el editor principal</p>
                </div>

                <div className="font-grid-specimens">
                  {fonts.map((f) => {
                    const isSelected = preferences.fontFamily === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`font-specimen-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ fontFamily: f.id })}
                      >
                        <span className={`font-specimen-title ${f.fontClass}`}>{f.name}</span>
                        {isSelected && <CheckIcon size={15} className="theme-check" />}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Tamaño de Fuente</h3>
                </div>

                <div className="size-selector-pills">
                  {fontSizes.map((s) => {
                    const isSelected = currentFontSize === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`size-pill-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ fontSize: s.id })}
                      >
                        <span>{s.label}</span>
                        <span className="size-pill-value">{s.note}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Muestra interactiva de ejemplo */}
                <div className="live-preview-surface">
                  <span className="live-preview-tag">Ejemplo</span>
                  <p
                    className="live-preview-content"
                    style={{
                      fontSize: currentFontSize,
                      fontFamily: currentFontFamily,
                      textAlign: currentTextAlign
                    }}
                  >
                    {fonts.find((f) => f.id === preferences.fontFamily)?.example ||
                      fonts[0].example}
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* PESTAÑA: ESCRITURA & MODO RODILLO */}
          {activeTab === 'writing' && (
            <div className="pref-tab-panel">
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Modo Rodillo (Typewriter)</h3>
                  <p className="section-desc">Enfoque continuo de concentración vertical</p>
                </div>

                <div
                  className={`typewriter-clean-card ${currentTypewriter ? 'is-active' : ''}`}
                  onClick={() => onUpdatePreferences({ typewriterMode: !currentTypewriter })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onUpdatePreferences({ typewriterMode: !currentTypewriter })
                    }
                  }}
                >
                  <div className="typewriter-clean-info">
                    <div className="typewriter-clean-header">
                      <TypewriterIcon size={18} />
                      <span className="typewriter-clean-title">Typewriter Scrolling</span>
                      {currentTypewriter && <span className="pref-pill-badge">Activo</span>}
                    </div>
                    <p className="typewriter-clean-desc">
                      Mantiene la línea donde escribes fija en el centro vertical de la pantalla.
                      Atajo rápido: <kbd className="pref-kbd">Ctrl+Shift+Y</kbd>
                    </p>
                  </div>

                  <div className={`pref-switch-modern ${currentTypewriter ? 'checked' : ''}`}>
                    <div className="pref-switch-thumb-modern" />
                  </div>
                </div>

                {currentTypewriter && (
                  <div className="typewriter-suboptions">
                    <span className="typewriter-suboptions-label">
                      Posición del ancla vertical:
                    </span>
                    <div className="typewriter-behavior-grid">
                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterPosition === 'center' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterPosition: 'center' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">Centrado exacto (50%)</span>
                          <span className="pref-pill-badge-subtle">Estándar</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          Fija la línea activa en la mitad vertical. Ofrece equilibrio simétrico
                          entre texto escrito y espacio despejado.
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterPosition === 'eye' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterPosition: 'eye' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">Línea de ojos (38%)</span>
                          <span className="pref-pill-badge-subtle">Ergonómico</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          Tercio superior. Ubica el renglón a la altura natural de la vista en
                          monitor, dejando más espacio inferior visible.
                        </span>
                      </button>
                    </div>

                    <span className="typewriter-suboptions-label" style={{ marginTop: '0.4rem' }}>
                      Navegación con flechas (Arriba / Abajo):
                    </span>
                    <div className="typewriter-behavior-grid">
                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterBehavior === 'deadzone' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterBehavior: 'deadzone' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">
                            Zona de tolerancia (Deadzone)
                          </span>
                          <span className="pref-pill-badge-subtle">Recomendado</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          Permite mover el cursor unas pocas líneas libremente para correcciones; se
                          re-centra suavemente al escribir.
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterBehavior === 'strict' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterBehavior: 'strict' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">Modo estricto</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          Re-centra la pantalla de forma continua con cada pulsación de flecha.
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Alineación del Párrafo</h3>
                  <p className="section-desc">Disposición del cuerpo de texto en el lienzo</p>
                </div>

                <div className="align-grid-modern">
                  {alignments.map((a) => {
                    const Icon = a.icon
                    const isSelected = currentTextAlign === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`align-card-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ textAlign: a.id })}
                      >
                        <div className="align-card-icon-row">
                          <Icon size={18} />
                          {isSelected && <CheckIcon size={14} className="theme-check" />}
                        </div>
                        <span className="align-card-name">{a.name}</span>
                        <span className="align-card-desc">{a.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="modal-footer-wide">
          <button className="btn-modal-close" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}
