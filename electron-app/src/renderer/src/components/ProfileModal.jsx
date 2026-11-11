import useModalFocus from '../hooks/useModalFocus'
import { useState, useEffect } from 'react'
import {
  CloseIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  PaletteIcon,
  AlignLeftIcon,
  AlignJustifyIcon,
  AlignCenterIcon,
  FeatherIcon,
  SettingsIcon,
  TrashIcon,
  FolderTreeIcon,
  BarChartIcon
} from './Icons'
import { getTranslation } from '../i18n'
import ConfirmModal from './ConfirmModal'
import { THEME_IDS } from '../lib/preferences'

export default function ProfileModal({
  isOpen,
  onClose,
  preferences,
  languagePreference,
  onUpdatePreferences,
  initialTab = 'general'
}) {
  const dialogRef = useModalFocus(isOpen)
  const normalizeTab = (tab) => {
    if (tab === 'appearance' || tab === 'typography') return 'appearance'
    if (tab === 'zen' || tab === 'writing') return 'writing'
    return 'general'
  }

  const [currentTabOverride, setCurrentTabOverride] = useState(null)
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab)

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab)
    setCurrentTabOverride(null)
  }

  const activeTab = currentTabOverride || normalizeTab(initialTab)
  const setActiveTab = (tab) => setCurrentTabOverride(tab)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [historyClearedMsg, setHistoryClearedMsg] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (confirmDialog) {
          setConfirmDialog(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose, confirmDialog])

  if (!isOpen) return null

  const currentLang = preferences.language || 'es'
  const t = getTranslation(currentLang)

  const tabs = [
    { id: 'general', label: t.preferences.tabs.general, icon: SettingsIcon },
    { id: 'appearance', label: t.preferences.tabs.appearance, icon: PaletteIcon },
    { id: 'writing', label: t.preferences.tabs.writing, icon: FeatherIcon }
  ]

  const modes = [
    { id: 'light', name: t.preferences.appearance.lightName, icon: SunIcon },
    { id: 'dark', name: t.preferences.appearance.darkName, icon: MoonIcon },
    { id: 'system', name: t.preferences.appearance.systemName, icon: MonitorIcon }
  ]

  const fonts = [
    { id: 'serif', name: 'Newsreader', fontClass: 'preview-font-serif', label: 'Serif' },
    { id: 'sans', name: 'Schibsted Grotesk', fontClass: 'preview-font-sans', label: 'Sans' },
    { id: 'mono', name: 'IBM Plex Mono', fontClass: 'preview-font-mono', label: 'Mono' }
  ]

  const fontSizes = [
    { id: '1.10rem', label: t.preferences.appearance.compact, note: '1.10' },
    { id: '1.40rem', label: t.preferences.appearance.standard, note: '1.40' },
    { id: '1.80rem', label: t.preferences.appearance.large, note: '1.80' }
  ]

  const alignments = [
    { id: 'left', name: t.preferences.appearance.alignLeftName, icon: AlignLeftIcon },
    { id: 'justify', name: t.preferences.appearance.alignJustifyName, icon: AlignJustifyIcon },
    { id: 'center', name: t.preferences.appearance.alignCenterName, icon: AlignCenterIcon }
  ]

  const historyMaxOptions = [
    { id: 20, label: '20' },
    { id: 50, label: '50' },
    { id: 100, label: '100' }
  ]

  const currentFontSize = preferences.fontSize || '1.40rem'
  const currentTextAlign = preferences.textAlign || 'left'
  const currentTypewriter = Boolean(preferences.typewriterMode)
  const currentTypewriterPosition = preferences.typewriterPosition || 'center'
  const currentTypewriterBehavior = preferences.typewriterBehavior || 'deadzone'
  const currentSpellcheck = preferences.spellcheckEnabled !== false
  const currentAutoSave = preferences.autoSaveEnabled !== false
  const currentHistory = preferences.historyEnabled !== false
  const currentHistoryMax = Number(preferences.historyMaxEntries) || 50

  const currentZenToolbar = preferences.zenShowToolbar !== false
  const currentZenStats = preferences.zenShowStats !== false
  const currentZenFolder = preferences.zenShowFolder !== false

  const currentFontFamily =
    preferences.fontFamily === 'sans'
      ? 'var(--font-ui)'
      : preferences.fontFamily === 'mono'
        ? 'var(--font-mono)'
        : 'var(--font-serif)'

  const handleToggleHistory = () => {
    if (currentHistory) {
      setConfirmDialog({
        title: t.preferences.general.historyDisableConfirmTitle,
        message: t.preferences.general.historyDisableConfirmDesc,
        confirmLabel: t.preferences.general.historyDisableConfirmBtn,
        cancelLabel: t.common.cancel,
        variant: 'danger',
        onConfirm: () => onUpdatePreferences({ historyEnabled: false })
      })
    } else {
      onUpdatePreferences({ historyEnabled: true })
    }
  }

  const handleSelectHistoryMax = (targetMax) => {
    if (targetMax < currentHistoryMax) {
      const diff = currentHistoryMax - targetMax
      const desc =
        typeof t.preferences.general.historyReduceConfirmDesc === 'function'
          ? t.preferences.general.historyReduceConfirmDesc(targetMax, diff)
          : t.preferences.general.historyReduceConfirmDesc
      setConfirmDialog({
        title: t.preferences.general.historyReduceConfirmTitle,
        message: desc,
        confirmLabel: t.preferences.general.historyReduceConfirmBtn,
        cancelLabel: t.common.cancel,
        variant: 'warning',
        onConfirm: async () => {
          onUpdatePreferences({ historyMaxEntries: targetMax })
          if (window.api?.historyPruneAll) {
            try {
              const result = await window.api.historyPruneAll(targetMax)
              if (!result?.success)
                throw new Error(result?.error || 'No se pudo podar el historial')
            } catch (err) {
              console.error('Error al podar historial:', err)
            }
          }
        }
      })
    } else {
      onUpdatePreferences({ historyMaxEntries: targetMax })
    }
  }

  const handleClearAllHistory = () => {
    if (!window.api?.historyClearAll) return
    setConfirmDialog({
      title: t.preferences.general.historyClearConfirmTitle,
      message: t.preferences.general.historyClearConfirmDesc,
      confirmLabel: t.preferences.general.historyClearConfirmBtn,
      cancelLabel: t.common.cancel,
      variant: 'danger',
      onConfirm: async () => {
        setClearingHistory(true)
        try {
          const result = await window.api.historyClearAll()
          if (!result?.success) throw new Error(result?.error || 'No se pudo limpiar el historial')
          setHistoryClearedMsg(true)
          setTimeout(() => setHistoryClearedMsg(false), 3000)
        } catch (err) {
          console.error('Error al limpiar todo el historial:', err)
        } finally {
          setClearingHistory(false)
        }
      }
    })
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal-card modal-card-wide"
          onClick={(e) => e.stopPropagation()}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <header className="modal-header-wide">
            <div className="modal-header-title-bar">
              <h2 id="modal-title" className="modal-title">
                {t.preferences.title}
              </h2>
              <button
                className="btn-icon-subtle"
                onClick={onClose}
                aria-label={t.common.close}
                title={`${t.common.close} (Esc)`}
              >
                <CloseIcon size={18} />
              </button>
            </div>

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
            {activeTab === 'general' && (
              <div className="pref-tab-panel">
                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">{t.preferences.general.languageTitle}</span>
                  </div>
                  <div className="pref-row-control">
                    <div className="pref-segment-group">
                      <button
                        type="button"
                        className={`pref-segment-btn ${languagePreference === 'system' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ language: 'system' })}
                      >
                        <span>{t.preferences.general.systemLanguageName}</span>
                      </button>
                      <button
                        type="button"
                        className={`pref-segment-btn ${languagePreference === 'es' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ language: 'es' })}
                      >
                        <span>{t.preferences.general.spanishName}</span>
                      </button>
                      <button
                        type="button"
                        className={`pref-segment-btn ${languagePreference === 'en' ? 'is-selected' : ''}`}
                        onClick={() => onUpdatePreferences({ language: 'en' })}
                      >
                        <span>{t.preferences.general.englishName}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">
                      {t.preferences.general.spellSectionTitle}
                    </span>
                  </div>
                  <div className="pref-row-control">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={currentSpellcheck}
                      className={`pref-switch ${currentSpellcheck ? 'is-active' : ''}`}
                      onClick={() => onUpdatePreferences({ spellcheckEnabled: !currentSpellcheck })}
                    >
                      <span className="pref-switch-handle" />
                    </button>
                  </div>
                </div>

                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">{t.preferences.general.autoSaveTitle}</span>
                    <span className="pref-row-desc">{t.preferences.general.autoSaveDesc}</span>
                  </div>
                  <div className="pref-row-control">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={currentAutoSave}
                      className={`pref-switch ${currentAutoSave ? 'is-active' : ''}`}
                      onClick={() =>
                        onUpdatePreferences({
                          autoSaveEnabled: !currentAutoSave,
                          autoSaveDelay: 2500
                        })
                      }
                    >
                      <span className="pref-switch-handle" />
                    </button>
                  </div>
                </div>

                <div className="pref-section-group">
                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">{t.preferences.general.historyTitle}</span>
                      <span className="pref-row-desc">{t.preferences.general.historyDesc}</span>
                    </div>
                    <div className="pref-row-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={currentHistory}
                        className={`pref-switch ${currentHistory ? 'is-active' : ''}`}
                        onClick={handleToggleHistory}
                      >
                        <span className="pref-switch-handle" />
                      </button>
                    </div>
                  </div>

                  {currentHistory && (
                    <div className="pref-suboptions-box">
                      <div className="pref-sub-row">
                        <span className="pref-sub-title">
                          {t.preferences.general.maxEntriesTitle}
                        </span>
                        <div className="pref-segment-group pref-segment-sm">
                          {historyMaxOptions.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className={`pref-segment-btn ${currentHistoryMax === opt.id ? 'is-selected' : ''}`}
                              onClick={() => handleSelectHistoryMax(opt.id)}
                            >
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pref-purge-inline">
                        <span className="pref-purge-desc">{t.preferences.general.purgeDesc}</span>
                        <button
                          type="button"
                          className="btn-sober-secondary btn-purge-danger"
                          onClick={handleClearAllHistory}
                          disabled={clearingHistory}
                        >
                          <TrashIcon size={13} />
                          <span>
                            {historyClearedMsg
                              ? t.preferences.general.purgedSuccess
                              : t.preferences.general.purgeBtn}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="pref-tab-panel">
                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">{t.preferences.appearance.modeTitle}</span>
                  </div>
                  <div className="pref-row-control">
                    <div className="pref-segment-group">
                      {modes.map((m) => {
                        const ModeIcon = m.icon
                        const isSelected = (preferences.mode || 'light') === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`pref-segment-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ mode: m.id })}
                          >
                            <ModeIcon size={14} />
                            <span>{m.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div
                  className="theme-mockup-wrapper"
                  role="group"
                  aria-label={t.preferences.appearance.themeDropdownLabel}
                >
                  {THEME_IDS.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className="theme-mockup-screen"
                      data-theme={`${theme}-${preferences.mode === 'dark' ? 'dark' : 'light'}`}
                      aria-label={t.preferences.appearance.themes[theme].name}
                      aria-pressed={preferences.theme === theme}
                      onClick={() => onUpdatePreferences({ theme })}
                    >
                      <span className="compact-mockup-split" aria-hidden="true">
                        {(preferences.mode === 'system'
                          ? ['light', 'dark']
                          : [preferences.mode]
                        ).map((mode) => (
                          <span
                            key={mode}
                            className="compact-mockup-half"
                            data-theme={`${theme}-${mode}`}
                          >
                            <span className="compact-mockup-dot" />
                            <span className="compact-mockup-lines">
                              <span className="compact-line" />
                              <span className="compact-line compact-line-accent" />
                            </span>
                          </span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">
                      {t.preferences.appearance.fontFamilyTitle}
                    </span>
                  </div>
                  <div className="pref-row-control">
                    <div className="pref-segment-group">
                      {fonts.map((f) => {
                        const isSelected = preferences.fontFamily === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className={`pref-segment-btn ${f.fontClass} ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ fontFamily: f.id })}
                          >
                            <span>{f.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">{t.preferences.appearance.fontSizeTitle}</span>
                  </div>
                  <div className="pref-row-control">
                    <div className="pref-segment-group">
                      {fontSizes.map((s) => {
                        const isSelected = currentFontSize === s.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`pref-segment-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ fontSize: s.id })}
                          >
                            <span>{s.label}</span>
                            <span className="pref-segment-note">{s.note}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="pref-row">
                  <div className="pref-row-info">
                    <span className="pref-row-title">{t.preferences.appearance.alignTitle}</span>
                  </div>
                  <div className="pref-row-control">
                    <div className="pref-segment-group">
                      {alignments.map((a) => {
                        const Icon = a.icon
                        const isSelected = currentTextAlign === a.id
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`pref-segment-btn ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ textAlign: a.id })}
                          >
                            <Icon size={14} />
                            <span>{a.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="live-preview-compact">
                  <p
                    className="live-preview-line"
                    style={{
                      fontSize: currentFontSize,
                      fontFamily: currentFontFamily,
                      textAlign: currentTextAlign
                    }}
                  >
                    {t.preferences.appearance.exampleText}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'writing' && (
              <div className="pref-tab-panel">
                <div className="pref-section-group">
                  <div className="pref-row">
                    <div className="pref-row-info">
                      <span className="pref-row-title">
                        {t.preferences.writing.typewriterTitle}
                      </span>
                      <span className="pref-row-desc">{t.preferences.writing.typewriterDesc}</span>
                    </div>
                    <div className="pref-row-control">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={currentTypewriter}
                        className={`pref-switch ${currentTypewriter ? 'is-active' : ''}`}
                        onClick={() => onUpdatePreferences({ typewriterMode: !currentTypewriter })}
                      >
                        <span className="pref-switch-handle" />
                      </button>
                    </div>
                  </div>

                  {currentTypewriter && (
                    <div className="pref-suboptions-box">
                      <div className="pref-sub-row">
                        <div className="pref-sub-info">
                          <span className="pref-sub-title">
                            {t.preferences.writing.anchorTitle}
                          </span>
                          <span className="pref-sub-desc">{t.preferences.writing.anchorDesc}</span>
                        </div>
                        <div className="pref-segment-group pref-segment-sm">
                          <button
                            type="button"
                            className={`pref-segment-btn ${currentTypewriterPosition === 'center' ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ typewriterPosition: 'center' })}
                          >
                            <span>{t.preferences.writing.anchorCenterTitle}</span>
                          </button>
                          <button
                            type="button"
                            className={`pref-segment-btn ${currentTypewriterPosition === 'eye' ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ typewriterPosition: 'eye' })}
                          >
                            <span>{t.preferences.writing.anchorEyeTitle}</span>
                          </button>
                        </div>
                      </div>

                      <div className="pref-sub-row">
                        <div className="pref-sub-info">
                          <span className="pref-sub-title">{t.preferences.writing.navTitle}</span>
                          <span className="pref-sub-desc">{t.preferences.writing.navDesc}</span>
                        </div>
                        <div className="pref-segment-group pref-segment-sm">
                          <button
                            type="button"
                            className={`pref-segment-btn ${currentTypewriterBehavior === 'deadzone' ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ typewriterBehavior: 'deadzone' })}
                          >
                            <span>{t.preferences.writing.navDeadzoneTitle}</span>
                          </button>
                          <button
                            type="button"
                            className={`pref-segment-btn ${currentTypewriterBehavior === 'strict' ? 'is-selected' : ''}`}
                            onClick={() => onUpdatePreferences({ typewriterBehavior: 'strict' })}
                          >
                            <span>{t.preferences.writing.navStrictTitle}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pref-divider" />

                <div className="pref-section-group">
                  <div className="pref-section-header">
                    <span className="pref-section-title">{t.preferences.writing.zenTitle}</span>
                    <span className="pref-section-desc">{t.preferences.writing.zenDesc}</span>
                  </div>

                  <div className="zen-mockup-compact-wrapper" aria-hidden="true">
                    <div className="zen-mockup-compact-screen">
                      <div
                        className={`zen-mockup-item-tag zen-mockup-folder ${
                          currentZenFolder ? 'is-visible' : 'is-hidden'
                        }`}
                      >
                        <FolderTreeIcon size={11} />
                        <span>{t.preferences.writing.zenFolderTitle}</span>
                      </div>

                      <div
                        className={`zen-mockup-item-tag zen-mockup-toolbar ${
                          currentZenToolbar ? 'is-visible' : 'is-hidden'
                        }`}
                      >
                        <span className="zen-mockup-dot" />
                        <span className="zen-mockup-dot" />
                        <span className="zen-mockup-kbd">Esc</span>
                      </div>

                      <div className="zen-mockup-canvas-lines">
                        <span className="zen-mockup-line line-main" />
                        <span className="zen-mockup-line line-sub" />
                        <span className="zen-mockup-line line-short" />
                        <span className="zen-mockup-cursor" />
                      </div>

                      <div
                        className={`zen-mockup-item-tag zen-mockup-stats ${
                          currentZenStats ? 'is-visible' : 'is-hidden'
                        }`}
                      >
                        <BarChartIcon size={11} />
                        <span>{t.preferences.writing.zenStatsTitle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="zen-clean-toggles">
                    <div className="pref-row">
                      <div className="pref-row-info">
                        <span className="pref-row-title">
                          {t.preferences.writing.zenToolbarTitle}
                        </span>
                      </div>
                      <div className="pref-row-control">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentZenToolbar}
                          className={`pref-switch ${currentZenToolbar ? 'is-active' : ''}`}
                          onClick={() =>
                            onUpdatePreferences({ zenShowToolbar: !currentZenToolbar })
                          }
                        >
                          <span className="pref-switch-handle" />
                        </button>
                      </div>
                    </div>

                    <div className="pref-row">
                      <div className="pref-row-info">
                        <span className="pref-row-title">
                          {t.preferences.writing.zenStatsTitle}
                        </span>
                      </div>
                      <div className="pref-row-control">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentZenStats}
                          className={`pref-switch ${currentZenStats ? 'is-active' : ''}`}
                          onClick={() => onUpdatePreferences({ zenShowStats: !currentZenStats })}
                        >
                          <span className="pref-switch-handle" />
                        </button>
                      </div>
                    </div>

                    <div className="pref-row">
                      <div className="pref-row-info">
                        <span className="pref-row-title">
                          {t.preferences.writing.zenFolderTitle}
                        </span>
                      </div>
                      <div className="pref-row-control">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={currentZenFolder}
                          className={`pref-switch ${currentZenFolder ? 'is-active' : ''}`}
                          onClick={() => onUpdatePreferences({ zenShowFolder: !currentZenFolder })}
                        >
                          <span className="pref-switch-handle" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
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

      {confirmDialog && (
        <ConfirmModal
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel || t.common.cancel}
          variant={confirmDialog.variant}
          onConfirm={() => {
            confirmDialog.onConfirm?.()
            setConfirmDialog(null)
          }}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </>
  )
}
