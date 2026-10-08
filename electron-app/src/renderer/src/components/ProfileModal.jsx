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
  FeatherIcon,
  LanguagesIcon,
  SpellCheckIcon,
  HistoryIcon,
  SaveIcon,
  TrashIcon,
  ZenFocusIcon,
  FolderTreeIcon,
  BarChartIcon
} from './Icons'
import { getTranslation } from '../i18n'

export default function ProfileModal({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  initialTab = 'appearance'
}) {
  const [currentTabOverride, setCurrentTabOverride] = useState(null)
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setCurrentTabOverride(null)
  }

  const activeTab = currentTabOverride || initialTab || 'appearance'
  const setActiveTab = (tab) => setCurrentTabOverride(tab)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [historyClearedMsg, setHistoryClearedMsg] = useState(false)

  // Manejar tecla Escape para cerrar modal con captura para no afectar Zen mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const currentLang = preferences.language || 'es'
  const t = getTranslation(currentLang)

  const tabs = [
    { id: 'appearance', label: t.preferences.tabs.appearance, icon: PaletteIcon },
    { id: 'typography', label: t.preferences.tabs.typography, icon: TypeIcon },
    { id: 'writing', label: t.preferences.tabs.writing, icon: FeatherIcon },
    {
      id: 'zen',
      label: t.preferences.tabs.zen || (currentLang === 'en' ? 'Zen Mode' : 'Modo Zen'),
      icon: ZenFocusIcon
    },
    {
      id: 'saving',
      label: t.preferences.tabs.saving || (currentLang === 'en' ? 'Saving' : 'Guardado'),
      icon: HistoryIcon
    },
    { id: 'language', label: t.preferences.tabs.language, icon: LanguagesIcon }
  ]

  const themeSpecimen = {
    id: 'puro',
    name: t.preferences.appearance.paletteName,
    subtitle: t.preferences.appearance.paletteSubtitle,
    desc: t.preferences.appearance.paletteDetail,
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
      name: t.preferences.appearance.lightName,
      desc: t.preferences.appearance.lightDesc,
      icon: SunIcon
    },
    {
      id: 'dark',
      name: t.preferences.appearance.darkName,
      desc: t.preferences.appearance.darkDesc,
      icon: MoonIcon
    },
    {
      id: 'system',
      name: t.preferences.appearance.systemName,
      desc: t.preferences.appearance.systemDesc,
      icon: MonitorIcon
    }
  ]

  const fonts = [
    {
      id: 'serif',
      name: 'Newsreader',
      fontClass: 'preview-font-serif',
      example: t.preferences.typography.exampleSerif
    },
    {
      id: 'sans',
      name: 'Schibsted Grotesk',
      fontClass: 'preview-font-sans',
      example: t.preferences.typography.exampleSans
    },
    {
      id: 'mono',
      name: 'IBM Plex Mono',
      fontClass: 'preview-font-mono',
      example: t.preferences.typography.exampleMono
    }
  ]

  const fontSizes = [
    { id: '1.10rem', label: t.preferences.typography.compact, note: '1.10rem' },
    { id: '1.40rem', label: t.preferences.typography.standard, note: '1.40rem' },
    { id: '1.80rem', label: t.preferences.typography.large, note: '1.80rem' }
  ]

  const alignments = [
    {
      id: 'left',
      name: t.preferences.writing.alignLeftName,
      desc: t.preferences.writing.alignLeftDesc,
      icon: AlignLeftIcon
    },
    {
      id: 'justify',
      name: t.preferences.writing.alignJustifyName,
      desc: t.preferences.writing.alignJustifyDesc,
      icon: AlignJustifyIcon
    },
    {
      id: 'center',
      name: t.preferences.writing.alignCenterName,
      desc: t.preferences.writing.alignCenterDesc,
      icon: AlignCenterIcon
    }
  ]

  const languagesList = [
    {
      id: 'es',
      name: t.preferences.language.spanishName,
      region: t.preferences.language.spanishRegion,
      desc: t.preferences.language.spanishDesc,
      tag: 'ES',
      dictCode: 'es-ES'
    },
    {
      id: 'en',
      name: t.preferences.language.englishName,
      region: t.preferences.language.englishRegion,
      desc: t.preferences.language.englishDesc,
      tag: 'EN',
      dictCode: 'en-US'
    }
  ]

  const currentFontSize = preferences.fontSize || '1.40rem'
  const currentTextAlign = preferences.textAlign || 'left'
  const currentTypewriter = Boolean(preferences.typewriterMode)
  const currentTypewriterPosition = preferences.typewriterPosition || 'center'
  const currentTypewriterBehavior = preferences.typewriterBehavior || 'deadzone'
  const currentSpellcheck = preferences.spellcheckEnabled !== false
  const currentAutoSave = preferences.autoSaveEnabled !== false
  const currentAutoSaveDelay = Number(preferences.autoSaveDelay) || 2500
  const currentHistory = preferences.historyEnabled !== false
  const currentHistoryMax = Number(preferences.historyMaxEntries) || 50
  const currentHistoryInterval = Number(preferences.historySnapshotInterval) || 120000

  const autoSaveDelays = [
    { id: 1000, label: currentLang === 'en' ? '1s (Fast)' : '1s (Rápido)', note: '1s' },
    { id: 2500, label: currentLang === 'en' ? '2.5s (Standard)' : '2.5s (Estándar)', note: '2.5s' },
    { id: 5000, label: currentLang === 'en' ? '5s (Relaxed)' : '5s (Pausado)', note: '5s' },
    { id: 10000, label: currentLang === 'en' ? '10s (Extended)' : '10s (Extendido)', note: '10s' }
  ]

  const historyMaxOptions = [
    { id: 20, label: '20' },
    { id: 50, label: currentLang === 'en' ? '50 (Standard)' : '50 (Estándar)' },
    { id: 100, label: '100' }
  ]

  const historyIntervalOptions = [
    { id: 60000, label: currentLang === 'en' ? '1 min' : '1 minuto' },
    { id: 120000, label: currentLang === 'en' ? '2 mins (Standard)' : '2 minutos (Estándar)' },
    { id: 300000, label: currentLang === 'en' ? '5 mins' : '5 minutos' }
  ]

  const handleClearAllHistory = async () => {
    if (!window.api?.historyClearAll) return
    const confirmText =
      currentLang === 'en'
        ? 'Are you sure you want to delete all saved version snapshots across all documents?'
        : '¿Estás seguro de que deseas eliminar todas las versiones temporales de todos los manuscritos?'
    if (window.confirm(confirmText)) {
      setClearingHistory(true)
      try {
        await window.api.historyClearAll()
        setHistoryClearedMsg(true)
        setTimeout(() => setHistoryClearedMsg(false), 3000)
      } catch (err) {
        console.error('Error al limpiar todo el historial:', err)
      } finally {
        setClearingHistory(false)
      }
    }
  }

  const currentZenToolbar = preferences.zenShowToolbar !== false
  const currentZenStats = preferences.zenShowStats !== false
  const currentZenFolder = preferences.zenShowFolder !== false

  const getActiveZenPreset = () => {
    if (currentZenToolbar && currentZenStats && currentZenFolder) return 'full'
    if (currentZenToolbar && currentZenStats && !currentZenFolder) return 'balanced'
    if (currentZenToolbar && !currentZenStats && !currentZenFolder) return 'minimal'
    if (!currentZenToolbar && !currentZenStats && !currentZenFolder) return 'pure'
    return 'custom'
  }

  const activeZenPreset = getActiveZenPreset()

  const zenPresets = [
    {
      id: 'full',
      title: t.preferences.zen?.presetFullTitle || (currentLang === 'en' ? 'Full' : 'Completo'),
      desc:
        t.preferences.zen?.presetFullDesc ||
        (currentLang === 'en'
          ? 'All floating windows active'
          : 'Todas las ventanas flotantes activas'),
      config: { zenShowToolbar: true, zenShowStats: true, zenShowFolder: true }
    },
    {
      id: 'balanced',
      title:
        t.preferences.zen?.presetBalancedTitle ||
        (currentLang === 'en' ? 'Balanced' : 'Equilibrado'),
      desc:
        t.preferences.zen?.presetBalancedDesc ||
        (currentLang === 'en'
          ? 'Toolbar & stats (no folder tree)'
          : 'Herramientas y estadísticas (sin explorador)'),
      config: { zenShowToolbar: true, zenShowStats: true, zenShowFolder: false }
    },
    {
      id: 'minimal',
      title:
        t.preferences.zen?.presetMinimalTitle || (currentLang === 'en' ? 'Minimal' : 'Minimalista'),
      desc:
        t.preferences.zen?.presetMinimalDesc ||
        (currentLang === 'en' ? 'Toolbar controls only' : 'Solo herramientas de control'),
      config: { zenShowToolbar: true, zenShowStats: false, zenShowFolder: false }
    },
    {
      id: 'pure',
      title: t.preferences.zen?.presetPureTitle || (currentLang === 'en' ? 'Pure Zen' : 'Zen Puro'),
      desc:
        t.preferences.zen?.presetPureDesc ||
        (currentLang === 'en'
          ? '100% clean canvas with zero floating windows'
          : 'Lienzo 100% limpio sin ventanas flotantes'),
      config: { zenShowToolbar: false, zenShowStats: false, zenShowFolder: false }
    }
  ]

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
                {t.preferences.title}
              </h2>
              <p className="modal-subtitle">{t.preferences.subtitle}</p>
            </div>
            <button
              className="btn-icon-subtle"
              onClick={onClose}
              aria-label={t.common.close}
              title={`${t.common.close} (Esc)`}
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
                  <h3 className="section-title">{t.preferences.appearance.modeTitle}</h3>
                  <p className="section-desc">{t.preferences.appearance.modeDesc}</p>
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
                  <h3 className="section-title">{t.preferences.appearance.paletteTitle}</h3>
                  <p className="section-desc">{t.preferences.appearance.paletteDesc}</p>
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
                  <h3 className="section-title">{t.preferences.typography.fontFamilyTitle}</h3>
                  <p className="section-desc">{t.preferences.typography.fontFamilyDesc}</p>
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
                  <h3 className="section-title">{t.preferences.typography.fontSizeTitle}</h3>
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
                  <span className="live-preview-tag">{t.common.preview}</span>
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
                  <h3 className="section-title">{t.preferences.writing.typewriterTitle}</h3>
                  <p className="section-desc">{t.preferences.writing.typewriterDesc}</p>
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
                      <span className="typewriter-clean-title">
                        {t.preferences.writing.typewriterCardTitle}
                      </span>
                      {currentTypewriter && (
                        <span className="pref-pill-badge">{t.common.active}</span>
                      )}
                    </div>
                    <p className="typewriter-clean-desc">
                      {t.preferences.writing.typewriterCardDesc}{' '}
                      {t.preferences.writing.typewriterShortcutHint}{' '}
                      <kbd className="pref-kbd">Ctrl+Shift+Y</kbd>
                    </p>
                  </div>

                  <div className={`pref-switch-modern ${currentTypewriter ? 'checked' : ''}`}>
                    <div className="pref-switch-thumb-modern" />
                  </div>
                </div>

                {currentTypewriter && (
                  <div className="typewriter-suboptions">
                    <span className="typewriter-suboptions-label">
                      {t.preferences.writing.anchorTitle}
                    </span>
                    <div className="typewriter-behavior-grid">
                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterPosition === 'center' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterPosition: 'center' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">
                            {t.preferences.writing.anchorCenterTitle}
                          </span>
                          <span className="pref-pill-badge-subtle">{t.common.standard}</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          {t.preferences.writing.anchorCenterDesc}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterPosition === 'eye' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterPosition: 'eye' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">
                            {t.preferences.writing.anchorEyeTitle}
                          </span>
                          <span className="pref-pill-badge-subtle">
                            {currentLang === 'en' ? 'Ergonomic' : 'Ergonómico'}
                          </span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          {t.preferences.writing.anchorEyeDesc}
                        </span>
                      </button>
                    </div>

                    <span className="typewriter-suboptions-label" style={{ marginTop: '0.4rem' }}>
                      {t.preferences.writing.navTitle}
                    </span>
                    <div className="typewriter-behavior-grid">
                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterBehavior === 'deadzone' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterBehavior: 'deadzone' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">
                            {t.preferences.writing.navDeadzoneTitle}
                          </span>
                          <span className="pref-pill-badge-subtle">{t.common.recommended}</span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          {t.preferences.writing.navDeadzoneDesc}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`typewriter-behavior-btn ${currentTypewriterBehavior === 'strict' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterBehavior: 'strict' })}
                      >
                        <div className="typewriter-behavior-header">
                          <span className="typewriter-behavior-title">
                            {t.preferences.writing.navStrictTitle}
                          </span>
                        </div>
                        <span className="typewriter-behavior-desc">
                          {t.preferences.writing.navStrictDesc}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">{t.preferences.writing.alignTitle}</h3>
                  <p className="section-desc">{t.preferences.writing.alignDesc}</p>
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

          {/* PESTAÑA: MODO ZEN & VENTANAS FLOTANTES */}
          {activeTab === 'zen' && (
            <div className="pref-tab-panel">
              {/* Sección 1: Presets de Limpieza */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">
                    {t.preferences.zen?.presetsTitle || 'Nivel de limpieza de pantalla:'}
                  </h3>
                  <p className="section-desc">
                    {t.preferences.zen?.desc ||
                      'Personaliza los elementos flotantes que se muestran al escribir a pantalla completa para adaptar el lienzo a tu nivel de concentración.'}
                  </p>
                </div>

                <div className="zen-preset-grid">
                  {zenPresets.map((p) => {
                    const isSelected = activeZenPreset === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`zen-preset-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences(p.config)}
                      >
                        <div className="zen-preset-header">
                          <span className="zen-preset-title">{p.title}</span>
                          {isSelected && <CheckIcon size={14} className="theme-check" />}
                        </div>
                        <span className="zen-preset-desc">{p.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Sección 2: Maqueta Visual Interactiva de la Pantalla */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">
                    {t.preferences.zen?.previewTitle || 'Vista previa de la pantalla Zen'}
                  </h3>
                </div>

                <div className="zen-mockup-wrapper">
                  <div className="zen-mockup-screen">
                    {/* Ventana flotante de carpeta (Superior Izquierda) */}
                    <div
                      className={`zen-mockup-element zen-mockup-folder ${
                        currentZenFolder ? 'is-active' : 'is-disabled'
                      }`}
                      title={t.preferences.zen?.folderTitle}
                    >
                      <FolderTreeIcon size={11} />
                      <span>{t.preferences.zen?.folderBadge || 'Superior Izq.'}</span>
                    </div>

                    {/* Barra flotante de herramientas (Superior Derecha) */}
                    <div
                      className={`zen-mockup-element zen-mockup-toolbar ${
                        currentZenToolbar ? 'is-active' : 'is-disabled'
                      }`}
                      title={t.preferences.zen?.toolbarTitle}
                    >
                      <span className="zen-mockup-dot" />
                      <span className="zen-mockup-dot" />
                      <span className="zen-mockup-kbd">Esc</span>
                    </div>

                    {/* Lienzo central (Manuscrito simulado) */}
                    <div className="zen-mockup-canvas">
                      <div className="zen-mockup-line line-main" />
                      <div className="zen-mockup-line line-sub" />
                      <div className="zen-mockup-line line-short" />
                      <span className="zen-mockup-cursor" />
                    </div>

                    {/* Barra flotante de estadísticas (Inferior Derecha) */}
                    <div
                      className={`zen-mockup-element zen-mockup-stats ${
                        currentZenStats ? 'is-active' : 'is-disabled'
                      }`}
                      title={t.preferences.zen?.statsTitle}
                    >
                      <BarChartIcon size={11} />
                      <span>{t.preferences.zen?.statsBadge || 'Inferior Der.'}</span>
                    </div>
                  </div>

                  <div className="zen-mockup-footer">
                    <span className="zen-mockup-status">
                      {!currentZenToolbar && !currentZenStats && !currentZenFolder
                        ? t.preferences.zen?.previewPureNotice ||
                          'Pantalla 100% limpia • Concentración absoluta sin ventanas flotantes. Usa Esc o F11 para salir.'
                        : t.preferences.zen?.previewActiveNotice ||
                          'Ventanas flotantes activas • Se revelan suavemente al mover el ratón.'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Sección 3: Conmutadores individuales de Ventanas Flotantes */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">
                    {t.preferences.zen?.title || 'Ventanas Flotantes'}
                  </h3>
                </div>

                <div className="zen-toggles-stack">
                  {/* Toggle 1: Navegador de carpetas */}
                  <div
                    className={`typewriter-clean-card ${currentZenFolder ? 'is-active' : ''}`}
                    onClick={() => onUpdatePreferences({ zenShowFolder: !currentZenFolder })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onUpdatePreferences({ zenShowFolder: !currentZenFolder })
                      }
                    }}
                  >
                    <div className="typewriter-clean-info">
                      <div className="typewriter-clean-header">
                        <FolderTreeIcon size={18} />
                        <span className="typewriter-clean-title">
                          {t.preferences.zen?.folderTitle || 'Navegador de documentos y carpetas'}
                        </span>
                        <span className="pref-pill-badge-subtle">
                          {t.preferences.zen?.folderBadge || 'Superior Izquierda'}
                        </span>
                        {currentZenFolder ? (
                          <span className="pref-pill-badge">{t.common.active}</span>
                        ) : (
                          <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                        )}
                      </div>
                      <p className="typewriter-clean-desc">
                        {t.preferences.zen?.folderDesc ||
                          'Ventana flotante en la esquina superior izquierda. Permite explorar y cambiar de documento dentro de la carpeta de trabajo.'}
                      </p>
                    </div>

                    <div className={`pref-switch-modern ${currentZenFolder ? 'checked' : ''}`}>
                      <div className="pref-switch-thumb-modern" />
                    </div>
                  </div>

                  {/* Toggle 2: Barra de herramientas */}
                  <div
                    className={`typewriter-clean-card ${currentZenToolbar ? 'is-active' : ''}`}
                    onClick={() => onUpdatePreferences({ zenShowToolbar: !currentZenToolbar })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onUpdatePreferences({ zenShowToolbar: !currentZenToolbar })
                      }
                    }}
                  >
                    <div className="typewriter-clean-info">
                      <div className="typewriter-clean-header">
                        <FeatherIcon size={18} />
                        <span className="typewriter-clean-title">
                          {t.preferences.zen?.toolbarTitle || 'Barra de herramientas superior'}
                        </span>
                        <span className="pref-pill-badge-subtle">
                          {t.preferences.zen?.toolbarBadge || 'Superior Derecha'}
                        </span>
                        {currentZenToolbar ? (
                          <span className="pref-pill-badge">{t.common.active}</span>
                        ) : (
                          <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                        )}
                      </div>
                      <p className="typewriter-clean-desc">
                        {t.preferences.zen?.toolbarDesc ||
                          'Píldora en la esquina superior derecha con accesos a modo rodillo, alineación, historial, atajos y botón de salir.'}
                      </p>
                      {!currentZenToolbar && (
                        <p
                          className="typewriter-clean-desc"
                          style={{ marginTop: '0.2rem', color: 'var(--text-secondary)' }}
                        >
                          💡{' '}
                          {t.preferences.zen?.toolbarHintEsc ||
                            'Al ocultar la barra, puedes salir del modo Zen en cualquier momento pulsando Esc o F11.'}
                        </p>
                      )}
                    </div>

                    <div className={`pref-switch-modern ${currentZenToolbar ? 'checked' : ''}`}>
                      <div className="pref-switch-thumb-modern" />
                    </div>
                  </div>

                  {/* Toggle 3: Barra de estadísticas */}
                  <div
                    className={`typewriter-clean-card ${currentZenStats ? 'is-active' : ''}`}
                    onClick={() => onUpdatePreferences({ zenShowStats: !currentZenStats })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onUpdatePreferences({ zenShowStats: !currentZenStats })
                      }
                    }}
                  >
                    <div className="typewriter-clean-info">
                      <div className="typewriter-clean-header">
                        <BarChartIcon size={18} />
                        <span className="typewriter-clean-title">
                          {t.preferences.zen?.statsTitle || 'Contador de estadísticas flotante'}
                        </span>
                        <span className="pref-pill-badge-subtle">
                          {t.preferences.zen?.statsBadge || 'Inferior Derecha'}
                        </span>
                        {currentZenStats ? (
                          <span className="pref-pill-badge">{t.common.active}</span>
                        ) : (
                          <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                        )}
                      </div>
                      <p className="typewriter-clean-desc">
                        {t.preferences.zen?.statsDesc ||
                          'Píldora en la esquina inferior derecha con conteo en vivo de palabras, caracteres, párrafos y tiempo estimado de lectura.'}
                      </p>
                      <p
                        className="typewriter-clean-desc"
                        style={{ marginTop: '0.2rem', color: 'var(--text-secondary)' }}
                      >
                        ⌨️{' '}
                        {t.preferences.zen?.statsHintHud ||
                          'Puedes abrir el HUD de estadísticas en cualquier momento pulsando Ctrl+Shift+C.'}
                      </p>
                    </div>

                    <div className={`pref-switch-modern ${currentZenStats ? 'checked' : ''}`}>
                      <div className="pref-switch-thumb-modern" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* PESTAÑA: GUARDADO & HISTORIAL */}
          {activeTab === 'saving' && (
            <div className="pref-tab-panel">
              {/* Sección 1: Auto-guardado */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">
                    {t.preferences.saving?.autoSaveTitle || 'Guardado Automático'}
                  </h3>
                  <p className="section-desc">
                    {t.preferences.saving?.autoSaveDesc ||
                      'Persiste automáticamente los cambios cada vez que dejas de escribir.'}
                  </p>
                </div>

                <div
                  className={`typewriter-clean-card ${currentAutoSave ? 'is-active' : ''}`}
                  onClick={() => onUpdatePreferences({ autoSaveEnabled: !currentAutoSave })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onUpdatePreferences({ autoSaveEnabled: !currentAutoSave })
                    }
                  }}
                >
                  <div className="typewriter-clean-info">
                    <div className="typewriter-clean-header">
                      <SaveIcon size={18} />
                      <span className="typewriter-clean-title">
                        {t.preferences.saving?.autoSaveCardTitle || 'Auto-guardado reactivo'}
                      </span>
                      {currentAutoSave ? (
                        <span className="pref-pill-badge">{t.common.active}</span>
                      ) : (
                        <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                      )}
                    </div>
                    <p className="typewriter-clean-desc">
                      {t.preferences.saving?.autoSaveCardDesc ||
                        'Guarda en el archivo de disco (o borrador local protegido) tras unos segundos de pausa.'}
                    </p>
                  </div>

                  <div className={`pref-switch-modern ${currentAutoSave ? 'checked' : ''}`}>
                    <div className="pref-switch-thumb-modern" />
                  </div>
                </div>

                {currentAutoSave && (
                  <div className="typewriter-suboptions">
                    <span className="typewriter-suboptions-label">
                      {t.preferences.saving?.delayTitle || 'Tiempo de espera tras pausar:'}
                    </span>
                    <div className="size-selector-pills">
                      {autoSaveDelays.map((d) => {
                        const isSelected = currentAutoSaveDelay === d.id
                        return (
                          <button
                            key={d.id}
                            type="button"
                            className={`size-pill-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ autoSaveDelay: d.id })}
                          >
                            <span>{d.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Sección 2: Historial Temporal */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">
                    {t.preferences.saving?.historyTitle || 'Historial Temporal de Versiones'}
                  </h3>
                  <p className="section-desc">
                    {t.preferences.saving?.historyDesc ||
                      'Registra instantáneas de tu manuscrito a lo largo del tiempo para inspección o recuperación (Ctrl+H).'}
                  </p>
                </div>

                <div
                  className={`typewriter-clean-card ${currentHistory ? 'is-active' : ''}`}
                  onClick={() => onUpdatePreferences({ historyEnabled: !currentHistory })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onUpdatePreferences({ historyEnabled: !currentHistory })
                    }
                  }}
                >
                  <div className="typewriter-clean-info">
                    <div className="typewriter-clean-header">
                      <HistoryIcon size={18} />
                      <span className="typewriter-clean-title">
                        {t.preferences.saving?.historyCardTitle || 'Instantáneas temporales'}
                      </span>
                      {currentHistory ? (
                        <span className="pref-pill-badge">{t.common.active}</span>
                      ) : (
                        <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                      )}
                    </div>
                    <p className="typewriter-clean-desc">
                      {t.preferences.saving?.historyCardDesc ||
                        'Guarda versiones al pulsar Ctrl+S y periódicamente durante el auto-guardado.'}
                    </p>
                  </div>

                  <div className={`pref-switch-modern ${currentHistory ? 'checked' : ''}`}>
                    <div className="pref-switch-thumb-modern" />
                  </div>
                </div>

                {currentHistory && (
                  <div className="typewriter-suboptions">
                    <span className="typewriter-suboptions-label">
                      {t.preferences.saving?.maxEntriesTitle ||
                        'Límite de versiones por manuscrito:'}
                    </span>
                    <div className="size-selector-pills">
                      {historyMaxOptions.map((opt) => {
                        const isSelected = currentHistoryMax === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`size-pill-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ historyMaxEntries: opt.id })}
                          >
                            <span>{opt.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <span className="typewriter-suboptions-label" style={{ marginTop: '0.6rem' }}>
                      {t.preferences.saving?.intervalTitle ||
                        'Frecuencia mínima entre versiones automáticas:'}
                    </span>
                    <div className="size-selector-pills">
                      {historyIntervalOptions.map((opt) => {
                        const isSelected = currentHistoryInterval === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`size-pill-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ historySnapshotInterval: opt.id })}
                          >
                            <span>{opt.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Mantenimiento de almacenamiento */}
                    <div className="history-purge-box" style={{ marginTop: '1rem' }}>
                      <div className="history-purge-info">
                        <span className="history-purge-title">
                          {t.preferences.saving?.purgeTitle || 'Limpieza de versiones acumuladas'}
                        </span>
                        <p className="history-purge-desc">
                          {t.preferences.saving?.purgeDesc ||
                            'Elimina todas las instantáneas temporales archivadas en el disco de la aplicación.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-sober-secondary btn-purge-danger"
                        onClick={handleClearAllHistory}
                        disabled={clearingHistory}
                      >
                        <TrashIcon size={14} />
                        <span>
                          {historyClearedMsg
                            ? t.preferences.saving?.purgedSuccess || 'Historial vaciado'
                            : t.preferences.saving?.purgeBtn || 'Vaciar todo el historial'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* PESTAÑA: IDIOMA & CORRECTOR ORTOGRÁFICO */}
          {activeTab === 'language' && (
            <div className="pref-tab-panel">
              {/* Sección 1: Selección de Idioma */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">{t.preferences.language.sectionTitle}</h3>
                  <p className="section-desc">{t.preferences.language.sectionDesc}</p>
                </div>

                <div className="mode-selector-grid">
                  {languagesList.map((langItem) => {
                    const isSelected = currentLang === langItem.id
                    return (
                      <button
                        key={langItem.id}
                        type="button"
                        className={`mode-card-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ language: langItem.id })}
                      >
                        <div
                          className="mode-card-icon"
                          style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em' }}
                        >
                          {langItem.tag}
                        </div>
                        <div className="mode-card-info">
                          <div className="mode-card-name-row">
                            <span className="mode-card-name">{langItem.name}</span>
                            {isSelected && <CheckIcon size={14} className="theme-check" />}
                          </div>
                          <span className="mode-card-desc" style={{ marginBottom: '0.2rem' }}>
                            {langItem.region}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            {langItem.desc}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Sección 2: Configuración del Corrector Ortográfico */}
              <section className="pref-section">
                <div className="section-heading">
                  <h3 className="section-title">{t.preferences.language.spellSectionTitle}</h3>
                  <p className="section-desc">{t.preferences.language.spellSectionDesc}</p>
                </div>

                {/* Switch de activación del corrector */}
                <div
                  className={`typewriter-clean-card ${currentSpellcheck ? 'is-active' : ''}`}
                  onClick={() => onUpdatePreferences({ spellcheckEnabled: !currentSpellcheck })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onUpdatePreferences({ spellcheckEnabled: !currentSpellcheck })
                    }
                  }}
                >
                  <div className="typewriter-clean-info">
                    <div className="typewriter-clean-header">
                      <SpellCheckIcon size={18} />
                      <span className="typewriter-clean-title">
                        {t.preferences.language.spellToggleTitle}
                      </span>
                      {currentSpellcheck ? (
                        <span className="pref-pill-badge">{t.common.active}</span>
                      ) : (
                        <span className="pref-pill-badge-subtle">{t.common.disabled}</span>
                      )}
                    </div>
                    <p className="typewriter-clean-desc">
                      {t.preferences.language.spellToggleDesc}
                    </p>
                  </div>

                  <div className={`pref-switch-modern ${currentSpellcheck ? 'checked' : ''}`}>
                    <div className="pref-switch-thumb-modern" />
                  </div>
                </div>

                {/* Tarjeta de información del diccionario activo */}
                <div className="theme-specimen-box" style={{ marginTop: '0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span
                      style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {t.preferences.language.activeDictionary}
                    </span>
                    <span
                      className="pref-pill-badge"
                      style={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      {currentLang === 'en'
                        ? t.preferences.language.dictionaryEnglish
                        : t.preferences.language.dictionarySpanish}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.86rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5
                    }}
                  >
                    {t.preferences.language.rightClickHint}
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="modal-footer-wide">
          <button className="btn-modal-close" onClick={onClose}>
            {t.common.done}
          </button>
        </footer>
      </div>
    </div>
  )
}
