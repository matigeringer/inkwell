import { useEffect, useRef, useState } from 'react'
import { PlusIcon, SunIcon, MoonIcon, SettingsIcon, FolderIcon, FileTextIcon } from './Icons'
import ManuscriptsZone from './ManuscriptsZone'
import WorkspaceSearch from './WorkspaceSearch'
import { getTranslation } from '../i18n'
import { listDrafts } from '../lib/drafts'

export default function Home({
  currentLang,
  isDark,
  isSystemMode,
  onToggleTheme,
  onToggleLanguage,
  onOpenProfile,
  notice,
  showToast,
  workspace,
  workspaceSearch,
  openWorkspaceResult,
  navigation,
  onItemRenamed,
  onItemDeleted,
  addMenuOpen,
  setAddMenuOpen,
  children
}) {
  const t = getTranslation(currentLang)
  const { folders: openedFolders, openFolder, refreshFolders, closeFolder } = workspace
  const {
    activeDoc,
    looseFiles,
    looseFileError,
    openFileDialog,
    createDocument,
    selectFile,
    openDraft,
    removeLooseFile
  } = navigation
  const [drafts, setDrafts] = useState(listDrafts)
  const addMenuRef = useRef(null)

  useEffect(() => window.api?.onRequestClose?.(() => true), [])

  useEffect(() => {
    const refresh = () => setDrafts(listDrafts())
    window.addEventListener('fountain-drafts-changed', refresh)
    return () => window.removeEventListener('fountain-drafts-changed', refresh)
  }, [])

  useEffect(() => {
    if (!addMenuOpen) return
    const dismissOutside = (event) => {
      if (!addMenuRef.current?.contains(event.target)) setAddMenuOpen(false)
    }
    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [addMenuOpen, setAddMenuOpen])

  const actions = [
    {
      index: 'I',
      icon: PlusIcon,
      title: t.home.newDocTitle,
      label: t.home.newDocument,
      shortcut: t.home.newDocShortcut,
      run: createDocument,
      primary: true
    },
    {
      index: 'II',
      icon: FileTextIcon,
      title: t.home.openFileTitle,
      label: t.home.openFile,
      shortcut: t.home.openFileShortcut,
      run: openFileDialog
    },
    {
      index: 'III',
      icon: FolderIcon,
      title: t.home.openFolderTitle,
      label: t.home.openFolder,
      shortcut: t.home.openFolderShortcut,
      run: openFolder
    }
  ]

  return (
    <div className="app-container">
      {notice}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-section">
            <div className="brand-header">
              <h1 className="app-title">{t.common.appName}</h1>
            </div>
            <hr className="brand-rule" />
          </div>

          <div className="sidebar-manuscripts-wrapper">
            <div className="sidebar-section-label">
              <span className="label-caps">{t.sidebar.manuscripts}</span>
              <div className="sidebar-add-wrap" ref={addMenuRef}>
                <button
                  type="button"
                  className="btn-sidebar-add-folder"
                  onClick={() => setAddMenuOpen((open) => !open)}
                  aria-label={
                    currentLang === 'en' ? 'Add file or folder' : 'Añadir archivo o carpeta'
                  }
                  aria-expanded={addMenuOpen}
                >
                  <PlusIcon size={13} />
                </button>
                {addMenuOpen && (
                  <div className="sidebar-add-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false)
                        openFileDialog()
                      }}
                    >
                      {t.home.openFile}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false)
                        openFolder()
                      }}
                    >
                      {t.home.openFolder}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {workspaceSearch.isOpen && (
              <WorkspaceSearch
                search={workspaceSearch}
                labels={t.workspaceSearch}
                navigationLabels={t.search}
                onOpen={openWorkspaceResult}
              />
            )}
            <ManuscriptsZone
              hidden={workspaceSearch.isOpen}
              openedFolders={openedFolders}
              looseFiles={looseFiles}
              looseFileError={looseFileError}
              showToast={showToast}
              onRemoveLooseFile={removeLooseFile}
              activeFilePath={activeDoc?.filePath || null}
              onSelectFile={selectFile}
              onItemRenamed={onItemRenamed}
              onItemDeleted={onItemDeleted}
              onRefreshFolderTree={refreshFolders}
              onCloseFolder={closeFolder}
              onSearchFolder={workspaceSearch.open}
              language={currentLang}
            />
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-settings-bar">
            <button
              className="sidebar-settings-btn"
              onClick={() => onOpenProfile('general')}
              type="button"
              title={t.sidebar.preferencesTitle}
            >
              <SettingsIcon size={16} />
              <span>{t.sidebar.preferences}</span>
            </button>

            <button
              className="btn-quick-theme"
              onClick={onToggleLanguage}
              type="button"
              title={t.sidebar.switchLanguageTitle}
              aria-label="Switch language"
              style={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em' }}
            >
              {currentLang.toUpperCase()}
            </button>

            <button
              className="btn-quick-theme"
              onClick={onToggleTheme}
              type="button"
              title={t.sidebar.themeToggleTitle(isDark, isSystemMode)}
              aria-label={t.sidebar.themeToggleAria}
            >
              {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="welcome-hero">
          <div className="welcome-brand">
            <h2 className="welcome-heading">
              {t.home.welcomeTitle} <em>{t.home.welcomeTitleEmphasis}</em>.
            </h2>
            <p className="welcome-subtitle">{t.home.welcomeSubtitle}</p>
          </div>

          {drafts.length > 0 && (
            <section
              className="recovered-drafts"
              aria-label={currentLang === 'en' ? 'Drafts' : 'Borradores'}
            >
              <h3>{currentLang === 'en' ? 'Recover a draft' : 'Recuperar un borrador'}</h3>
              {drafts.map((draft) => (
                <button
                  type="button"
                  key={draft.id}
                  className="welcome-action-card"
                  onClick={() => openDraft(draft)}
                >
                  <FileTextIcon size={15} />
                  <span>
                    {draft.fileName} — {draft.content.slice(0, 60)}
                  </span>
                </button>
              ))}
            </section>
          )}

          <span className="label-caps welcome-index-label">{t.home.contents}</span>
          <div className="welcome-actions">
            {actions.map(({ index, icon: Icon, title, label, shortcut, run, primary }) => (
              <button
                key={index}
                className={`welcome-action-card${primary ? ' welcome-action-primary' : ''}`}
                onClick={run}
                type="button"
                title={title}
              >
                <span className="action-index-num">{index}.</span>
                <span className="action-card-left">
                  <Icon size={15} />
                  <span>{label}</span>
                </span>
                <span className="action-leader" aria-hidden="true" />
                <kbd className="action-kbd">{shortcut}</kbd>
              </button>
            ))}
          </div>
        </div>
      </main>

      {children}
    </div>
  )
}
