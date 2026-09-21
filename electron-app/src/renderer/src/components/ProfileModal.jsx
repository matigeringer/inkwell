import { useEffect } from 'react'
import {
  CloseIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  TypeIcon,
  CheckIcon,
  TypewriterIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon
} from './Icons'

export default function ProfileModal({ isOpen, onClose, preferences, onUpdatePreferences }) {
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

  const themes = [
    {
      id: 'light',
      name: 'Linen',
      label: 'Linen',
      desc: 'Lino cálido y tinta profunda',
      icon: SunIcon
    },
    {
      id: 'dark',
      name: 'Obsidian',
      label: 'Obsidian',
      desc: 'Obsidiana y salvia luminosa',
      icon: MoonIcon
    },
    {
      id: 'system',
      name: 'Sistema',
      label: 'Automático',
      desc: 'Sincronizado con el sistema',
      icon: MonitorIcon
    }
  ]

  const alignments = [
    {
      id: 'left',
      name: 'Izquierda',
      desc: 'Alineación natural estándar',
      icon: AlignLeftIcon
    },
    {
      id: 'justify',
      name: 'Justificado',
      desc: 'Márgenes uniformes estilo editorial',
      icon: AlignJustifyIcon
    },
    {
      id: 'center',
      name: 'Centrado',
      desc: 'Centrado lírico o dramatúrgico',
      icon: AlignCenterIcon
    }
  ]

  const fonts = [
    {
      id: 'serif',
      name: 'Newsreader (Serif)',
      desc: 'Diseño editorial cálido para literatura y narrativa',
      preview: 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme...',
      familyClass: 'preview-font-serif'
    },
    {
      id: 'sans',
      name: 'Plus Jakarta (Sans)',
      desc: 'Moderna, limpia y de máxima claridad visual',
      preview: 'El pensamiento claro precede a la escritura fluida...',
      familyClass: 'preview-font-sans'
    },
    {
      id: 'mono',
      name: 'JetBrains (Mono)',
      desc: 'Estilo máquina de escribir para redacción técnica y borrador',
      preview: '01. Hipótesis inicial y estructura del manuscrito...',
      familyClass: 'preview-font-mono'
    }
  ]

  const fontSizes = [
    { id: '1.10rem', label: 'Compacto' },
    { id: '1.40rem', label: 'Estándar' },
    { id: '1.80rem', label: 'Amplio' }
  ]

  const currentFontSize = preferences.fontSize || '1.40rem'
  const currentTextAlign = preferences.textAlign || 'left'
  const currentTypewriter = Boolean(preferences.typewriterMode)
  const currentFontFamily =
    preferences.fontFamily === 'sans'
      ? 'var(--font-ui)'
      : preferences.fontFamily === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-serif)'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div className="modal-title-group">
            <div>
              <h2 id="modal-title" className="modal-title">
                Preferencias
              </h2>
              <p className="modal-subtitle">
                Personaliza el tema, la tipografía y el modo de escritura
              </p>
            </div>
          </div>

          <button
            className="btn-icon-subtle"
            onClick={onClose}
            aria-label="Cerrar modal"
            title="Cerrar (Esc)"
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="modal-body">
          {/* Selector de Tema: Claro / Oscuro / Sistema */}
          <section className="pref-section">
            <label className="pref-label">
              <span>Tema de la Aplicación</span>
            </label>
            <div className="theme-grid">
              {themes.map((t) => {
                const Icon = t.icon
                const isSelected = preferences.theme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-option ${isSelected ? 'active' : ''} theme-option-${t.id}`}
                    onClick={() => onUpdatePreferences({ theme: t.id })}
                  >
                    <div className="theme-option-header">
                      <Icon size={18} />
                      {isSelected && <CheckIcon size={14} className="check-mark" />}
                    </div>
                    <span className="theme-name">{t.label}</span>
                    <span className="theme-desc">{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Modo Máquina de Escribir (Typewriter Scrolling) */}
          <section className="pref-section">
            <label className="pref-label">
              <TypewriterIcon size={16} />
              <span>Desplazamiento Estilo Máquina de Escribir</span>
            </label>
            <div
              className={`typewriter-toggle-card ${currentTypewriter ? 'active' : ''}`}
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
              <div className="typewriter-card-left">
                <TypewriterIcon size={20} className="typewriter-card-icon" />
                <div className="typewriter-card-texts">
                  <div className="typewriter-card-title-row">
                    <span className="typewriter-card-title">Typewriter Scrolling</span>
                    {currentTypewriter && <span className="font-active-pill">Activo</span>}
                  </div>
                  <span className="typewriter-card-desc">
                    Mantiene la línea actual donde escribes siempre fija en el centro vertical de la
                    pantalla. (Atajo: Ctrl+Shift+Y)
                  </span>
                </div>
              </div>
              <div className={`pref-switch ${currentTypewriter ? 'checked' : ''}`}>
                <div className="pref-switch-thumb" />
              </div>
            </div>
          </section>

          {/* Alineación de Texto del Manuscrito */}
          <section className="pref-section">
            <label className="pref-label">
              <AlignJustifyIcon size={16} />
              <span>Alineación de Escritura y Párrafo</span>
            </label>
            <div className="align-options-grid">
              {alignments.map((a) => {
                const Icon = a.icon
                const isSelected = currentTextAlign === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`align-option-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => onUpdatePreferences({ textAlign: a.id })}
                  >
                    <div className="align-option-header">
                      <Icon size={18} />
                      {isSelected && <CheckIcon size={14} className="check-mark" />}
                    </div>
                    <span className="align-option-name">{a.name}</span>
                    <span className="align-option-desc">{a.desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Tipografía de Escritura */}
          <section className="pref-section">
            <label className="pref-label">
              <TypeIcon size={16} />
              <span>Tipografía de Escritura (Editor)</span>
            </label>
            <div className="font-options-list">
              {fonts.map((f) => {
                const isSelected = preferences.fontFamily === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`font-option ${isSelected ? 'active' : ''}`}
                    onClick={() => onUpdatePreferences({ fontFamily: f.id })}
                  >
                    <div className="font-option-info">
                      <div className="font-option-title-row">
                        <span className="font-option-name">{f.name}</span>
                        {isSelected && <span className="font-active-pill">Activa</span>}
                      </div>
                      <span className="font-option-desc">{f.desc}</span>
                      <p className={`font-preview-sample ${f.familyClass}`}>{f.preview}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Tamaño de texto del editor con vista previa en vivo */}
          <section className="pref-section">
            <label className="pref-label">
              <span>Tamaño y Muestra de Texto del Editor</span>
            </label>
            <div className="size-selector-grid">
              {fontSizes.map((s) => {
                const isSelected = currentFontSize === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`size-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => onUpdatePreferences({ fontSize: s.id })}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div className="size-live-preview-box">
              <span className="size-preview-label">Vista previa en tiempo real:</span>
              <p
                className="size-preview-text"
                style={{
                  fontSize: currentFontSize,
                  fontFamily: currentFontFamily,
                  textAlign: currentTextAlign
                }}
              >
                El arte de escribir consiste en plasmar ideas con claridad, serenidad y ritmo,
                manteniendo un equilibrio armonioso entre la forma de las palabras y el lienzo sobre
                el que descansan.
              </p>
            </div>
          </section>
        </div>

        <footer className="modal-footer">
          <button className="btn-done" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}
