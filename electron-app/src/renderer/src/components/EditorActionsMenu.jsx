import {
  ChevronDownIcon,
  ExportIcon,
  FileDocxIcon,
  FileMarkdownIcon,
  FileOdtIcon,
  FilePdfIcon,
  FileTextIcon,
  MenuIcon,
  SaveAsIcon,
  SaveIcon,
  SettingsIcon
} from './Icons'

const EXPORT_OPTIONS = [
  {
    key: 'pdf',
    ext: '.pdf',
    icon: FilePdfIcon,
    nameKey: 'pdfName',
    descKey: 'pdfDesc',
    badgeKey: 'pdfBadge'
  },
  {
    key: 'docx',
    ext: '.docx',
    icon: FileDocxIcon,
    nameKey: 'docxName',
    descKey: 'docxDesc',
    badgeKey: 'docxBadge'
  },
  {
    key: 'odt',
    ext: '.odt',
    icon: FileOdtIcon,
    nameKey: 'odtName',
    descKey: 'odtDesc',
    badgeKey: 'odtBadge'
  },
  {
    key: 'markdown',
    ext: '.md',
    icon: FileMarkdownIcon,
    nameKey: 'markdownName',
    descKey: 'markdownDesc',
    badgeKey: 'markdownBadge'
  },
  {
    key: 'txt',
    ext: '.txt',
    icon: FileTextIcon,
    nameKey: 'txtName',
    descKey: 'txtNameDesc',
    badgeKey: 'txtNameBadge'
  }
]

export default function EditorActionsMenu({
  t,
  actionsOpen,
  setActionsOpen,
  actionsRef,
  exportOpen,
  setExportOpen,
  exportRef,
  isExporting,
  saveStatus,
  onOpenProfile,
  onSave,
  onSaveAs,
  onExport
}) {
  return (
    <div className="action-menu-wrapper" ref={actionsRef}>
      {actionsOpen && (
        <div className="action-menu-dock">
          {onOpenProfile && (
            <button
              className="btn-sober-secondary action-dock-btn"
              onClick={() => {
                setActionsOpen(false)
                onOpenProfile()
              }}
              title={t.editor.preferencesTitle}
              aria-label={t.editor.preferencesAria}
            >
              <SettingsIcon size={15} />
              <span className="header-btn-label">{t.editor.settingsBtn}</span>
            </button>
          )}

          <div className="export-dropdown-wrapper" ref={exportRef}>
            <button
              className={`btn-sober-secondary export-trigger-btn ${exportOpen ? 'is-active' : ''}`}
              onClick={() => setExportOpen((prev) => !prev)}
              title={t.editor.exportTitle}
              aria-label={t.editor.export}
              aria-expanded={exportOpen}
              aria-haspopup="true"
              disabled={isExporting}
            >
              <ExportIcon size={15} />
              <span className="header-btn-label">{t.editor.export}</span>
              <ChevronDownIcon
                size={13}
                className={`export-chevron ${exportOpen ? 'is-open' : ''}`}
              />
            </button>

            {exportOpen && (
              <div className="export-dropdown-menu" role="menu" aria-label={t.editor.exportTitle}>
                <div className="export-dropdown-header">
                  <span className="export-dropdown-title">
                    {t.exportFormats?.menuTitle || t.editor.exportChooseFormat}
                  </span>
                </div>
                <div className="export-dropdown-list">
                  {EXPORT_OPTIONS.map((opt) => {
                    const IconComponent = opt.icon
                    const name = t.exportFormats?.[opt.nameKey] || opt.ext
                    const desc = t.exportFormats?.[opt.descKey] || ''
                    const badge =
                      t.exportFormats?.[opt.badgeKey] || opt.ext.replace('.', '').toUpperCase()

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className="export-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          onExport(opt.key)
                          setActionsOpen(false)
                        }}
                      >
                        <div className="export-item-icon-wrapper">
                          <IconComponent size={16} />
                        </div>
                        <div className="export-item-content">
                          <div className="export-item-row">
                            <span className="export-item-name">{name}</span>
                            <span className="export-item-badge">{badge}</span>
                          </div>
                          {desc && <span className="export-item-desc">{desc}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button className="btn-sober-secondary" onClick={onSaveAs} title={t.editor.saveAsTitle}>
            <SaveAsIcon size={15} />
            <span className="header-btn-label">{t.editor.saveAs}</span>
          </button>

          <button
            className="btn-sober-primary"
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            title={t.editor.saveTitle}
          >
            <SaveIcon size={15} />
            <span className="header-btn-label">{t.editor.save}</span>
          </button>
        </div>
      )}

      <button
        className={`btn-sober-secondary action-menu-trigger ${actionsOpen ? 'is-active' : ''}`}
        onClick={() => {
          setActionsOpen((prev) => !prev)
          if (actionsOpen) setExportOpen(false)
        }}
        title={actionsOpen ? t.editor.closeActionsMenu : t.editor.actionsMenuTitle}
        aria-label={t.editor.actionsMenuAria}
        aria-expanded={actionsOpen}
        aria-haspopup="true"
      >
        <MenuIcon size={15} />
        {!actionsOpen && <span className="header-btn-label">{t.editor.actionsMenu}</span>}
        <ChevronDownIcon
          size={13}
          className={`action-menu-chevron ${actionsOpen ? 'is-open' : ''}`}
        />
      </button>
    </div>
  )
}
