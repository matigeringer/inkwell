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

  const themeSpecimen = {
    id: 'puro',
    name: 'Puro',
    subtitle: 'Prueba de imprenta',
    desc: 'Papel de galera en gris cálido, tinta carbón, lápiz bermellón de corrector y trazo azul no-reproducible.',
    light: {
      bg: '#efeee8',
      sidebar: '#e4e3db',
      text: '#1c1d1a',
      accent: '#c2381b'
    },
    dark: {
      bg: '#161814',
      sidebar: '#111310',
      text: '#e6e3d6',
      accent: '#ee6342'
    }
  }

  const modes = [
    {
      id: 'light',
      name: 'Claro',
      desc: 'Papel de galera iluminado',
      icon: SunIcon
    },
    {
      id: 'dark',
      name: 'Oscuro',
      desc: 'Linotipia nocturna',
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
      name: 'Schibsted Grotesk',
      fontClass: 'preview-font-sans',
      example:
        'El pensamiento claro precede a la escritura fluida y directa. Las palabras exactas encuentran su ritmo natural sobre un lienzo silencioso.'
    },
    {
      id: 'mono',
      name: 'IBM Plex Mono',
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
          {/* PESTAÑA: APARIENCIA */}
          {activeTab === 'appearance' && (
            <div className="pref-tab-panel">
              {/* Sección 1: Modo de Iluminación */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Modo de Iluminación</h3>
                  <p className="section-desc">
                    Selecciona la iluminación para el lienzo y la interfaz
                  </p>
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

              {/* Sección 2: Muestra de Imprenta */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">Paleta Editorial</h3>
                  <p className="section-desc">Materiales y proporciones del taller tipográfico</p>
                </div>

                <div className="theme-specimen-box">
                  <div className="theme-mini-mockup">
                    {preferences.mode === 'system' ? (
                      <div className="mini-mockup-frame mini-mockup-split">
                        <div
                          className="mini-mockup-half"
                          style={{ backgroundColor: themeSpecimen.light.bg }}
                        >
                          <div
                            className="mini-mockup-sidebar"
                            style={{ backgroundColor: themeSpecimen.light.sidebar }}
                          >
                            <span
                              className="mini-mockup-dot"
                              style={{ backgroundColor: themeSpecimen.light.accent }}
                            />
                          </div>
                          <div className="mini-mockup-content">
                            <span
                              className="mini-line line-primary"
                              style={{ backgroundColor: themeSpecimen.light.text }}
                            />
                            <span
                              className="mini-line line-secondary"
                              style={{ backgroundColor: themeSpecimen.light.accent }}
                            />
                          </div>
                        </div>
                        <div
                          className="mini-mockup-half"
                          style={{
                            backgroundColor: themeSpecimen.dark.bg,
                            borderLeft: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div
                            className="mini-mockup-sidebar"
                            style={{ backgroundColor: themeSpecimen.dark.sidebar }}
                          >
                            <span
                              className="mini-mockup-dot"
                              style={{ backgroundColor: themeSpecimen.dark.accent }}
                            />
                          </div>
                          <div className="mini-mockup-content">
                            <span
                              className="mini-line line-primary"
                              style={{ backgroundColor: themeSpecimen.dark.text }}
                            />
                            <span
                              className="mini-line line-secondary"
                              style={{ backgroundColor: themeSpecimen.dark.accent }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const palette =
                          preferences.mode === 'dark' ? themeSpecimen.dark : themeSpecimen.light
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
                      <span className="theme-card-name">
                        {themeSpecimen.name} — {themeSpecimen.subtitle}
                      </span>
                    </div>
                    <span className="theme-card-desc">{themeSpecimen.desc}</span>
                  </div>
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
