import { useEffect } from 'react'
import {
  CloseIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  TypeIcon,
  CheckIcon,
  SettingsIcon
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
      name: 'Parchment',
      label: 'Claro',
      desc: 'Papel vitela y tinta sumi',
      icon: SunIcon
    },
    {
      id: 'dark',
      name: 'Obsidian',
      label: 'Oscuro',
      desc: 'Medianoche y acentos salvia',
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
            <div className="modal-avatar-badge">
              <SettingsIcon size={18} className="modal-avatar-icon" />
            </div>
            <div>
              <h2 id="modal-title" className="modal-title">
                Preferencias
              </h2>
              <p className="modal-subtitle">Personaliza el tema y la tipografía de lectura</p>
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
              <span>Tamaño de Texto del Editor</span>
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
              <span className="size-preview-label">Muestra de tamaño:</span>
              <p
                className="size-preview-text"
                style={{
                  fontSize: currentFontSize,
                  fontFamily: currentFontFamily
                }}
              >
                El arte de escribir consiste en plasmar ideas con claridad y serenidad.
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
