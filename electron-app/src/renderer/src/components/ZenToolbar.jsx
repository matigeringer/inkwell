import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  HistoryIcon,
  KeyboardIcon,
  SearchIcon,
  SettingsIcon,
  TypewriterIcon
} from './Icons'

export default function ZenToolbar({
  t,
  currentLang,
  preferences,
  visible,
  isSearchOpen,
  openSearch,
  outlineSearch,
  toggleTypewriterMode,
  cycleTextAlign,
  onOpenHistory,
  onOpenShortcuts,
  onOpenProfile,
  onExit
}) {
  return (
    <aside
      className={`zen-floating-toolbar ${visible ? 'visible' : ''}`}
      aria-label="Controles discretos de modo Zen"
    >
      <div className="zen-toolbar-pill">
        <button
          type="button"
          className={`zen-pill-btn zen-pill-icon-only ${isSearchOpen ? 'active' : ''}`}
          onClick={openSearch}
          title={`${t.search.title} (Ctrl+F)`}
          aria-label={t.search.title}
          aria-expanded={isSearchOpen}
          aria-controls={isSearchOpen ? 'manuscript-search' : undefined}
          aria-keyshortcuts="Control+F Meta+F"
        >
          <SearchIcon size={15} aria-hidden="true" />
        </button>
        {outlineSearch}
        <button
          className={`zen-pill-btn zen-pill-icon-only ${preferences?.typewriterMode ? 'active' : ''}`}
          onClick={toggleTypewriterMode}
          title={t.editor.typewriterTitle(preferences?.typewriterMode)}
          aria-label={t.editor.typewriterAria}
        >
          <TypewriterIcon size={15} />
        </button>
        <button
          className={`zen-pill-btn zen-pill-icon-only ${preferences?.textAlign === 'justify' ? 'active' : ''}`}
          onClick={cycleTextAlign}
          title={t.editor.alignTitle(preferences?.textAlign)}
          aria-label={t.editor.alignAria}
        >
          {preferences?.textAlign === 'justify' ? (
            <AlignJustifyIcon size={15} />
          ) : preferences?.textAlign === 'center' ? (
            <AlignCenterIcon size={15} />
          ) : (
            <AlignLeftIcon size={15} />
          )}
        </button>
        <button
          className="zen-pill-btn zen-pill-icon-only"
          onClick={() => onOpenHistory()}
          title={
            t.editor.historyTitle ||
            (currentLang === 'en' ? 'Version history (Ctrl+H)' : 'Historial de versiones (Ctrl+H)')
          }
          aria-label={t.editor.historyAria || 'Historial de versiones'}
        >
          <HistoryIcon size={15} />
        </button>
        <button
          className="zen-pill-btn zen-pill-icon-only"
          onClick={() => onOpenShortcuts()}
          title={t.editor.shortcutsBtnTitle}
          aria-label={t.editor.shortcutsBtnAria}
        >
          <KeyboardIcon size={15} />
        </button>
        {onOpenProfile && (
          <button
            className="zen-pill-btn zen-pill-icon-only"
            onClick={() => onOpenProfile('zen')}
            title={
              t.editor.zenSettingsTitle ||
              (currentLang === 'en'
                ? 'Customize Zen Mode & floating windows (Ctrl+,)'
                : 'Personalizar Modo Zen y ventanas flotantes (Ctrl+,)')
            }
            aria-label={t.editor.zenSettingsAria || 'Personalizar Modo Zen'}
          >
            <SettingsIcon size={15} />
          </button>
        )}
        <div className="zen-pill-divider" />
        <button
          className="zen-pill-btn zen-pill-exit"
          onClick={() => onExit()}
          title={t.editor.zenExitTitle}
        >
          <span>{t.editor.zenExit}</span>
          <kbd className="zen-kbd-hint">Esc</kbd>
        </button>
      </div>
    </aside>
  )
}
