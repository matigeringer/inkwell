import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from './components/Editor'
import Home from './components/Home'
import ProfileModal from './components/ProfileModal'
import useAppPreferences from './hooks/useAppPreferences'
import useAppShortcuts from './hooks/useAppShortcuts'
import useDocumentNavigation from './hooks/useDocumentNavigation'
import useWorkspaceFolders from './hooks/useWorkspaceFolders'
import useWorkspaceSearch from './hooks/useWorkspaceSearch'
import { getTranslation } from './i18n'

export default function App() {
  const [notice, setNotice] = useState('')
  const [profileTab, setProfileTab] = useState(null)
  const [isZenMode, setIsZenMode] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const showToast = useCallback((message) => setNotice(message), [])

  const {
    preferences,
    languagePreference,
    isDark,
    updatePreferences,
    toggleTheme,
    toggleLanguage
  } = useAppPreferences(showToast)
  const language = preferences.language
  const t = getTranslation(language)
  const workspace = useWorkspaceFolders(showToast)
  const {
    folders,
    activeFolder,
    activateFolder,
    recentFiles,
    openFolder,
    refreshFolders,
    closeFolder,
    renameItem: renameInWorkspace,
    removeItem: removeFromWorkspace
  } = workspace
  const navigation = useDocumentNavigation({
    language,
    folders,
    activateFolder,
    recentFiles,
    showToast
  })
  const {
    activeDoc,
    isEditing,
    createDocument,
    openFileDialog,
    selectFile,
    workspaceJump,
    setWorkspaceJump,
    renameItem: renameInNavigation,
    removeItem: removeFromNavigation
  } = navigation
  const workspaceSearch = useWorkspaceSearch(folders)
  const { invalidate, selectMatch } = workspaceSearch
  const workspaceRequestId = workspaceSearch.result?.id
  const workspaceOpenPending = useRef(false)

  useEffect(() => {
    if (window.api?.onFullScreenChange) return window.api.onFullScreenChange(setIsZenMode)
    const sync = () => setIsZenMode(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useAppShortcuts({
    isEditing,
    activeFolder,
    workspaceSearch,
    addMenuOpen,
    setAddMenuOpen,
    createDocument,
    openFileDialog,
    openFolder
  })

  const openProfile = useCallback((tab = 'general') => setProfileTab(tab), [])
  const closeProfile = useCallback(() => setProfileTab(null), [])

  const openWorkspaceResult = useCallback(
    async (group, match, current = false) => {
      if (workspaceOpenPending.current) return false
      workspaceOpenPending.current = true
      const jump = {
        path: group.path,
        match,
        version: group.version,
        requestId: workspaceRequestId
      }
      try {
        if (!current) return await selectFile(group.path, group.folderPath, jump)
        setWorkspaceJump(jump)
        return true
      } finally {
        workspaceOpenPending.current = false
      }
    },
    [selectFile, setWorkspaceJump, workspaceRequestId]
  )

  const finishWorkspaceJump = useCallback(
    (jump, found) => {
      setWorkspaceJump((current) => (current === jump ? null : current))
      if (found) selectMatch(jump.requestId, jump.path, jump.match)
      else showToast(t.workspaceSearch.stale)
    },
    [selectMatch, setWorkspaceJump, showToast, t.workspaceSearch.stale]
  )

  const handleItemRenamed = useCallback(
    (rename) => {
      invalidate()
      renameInNavigation(rename)
      renameInWorkspace(rename)
    },
    [invalidate, renameInNavigation, renameInWorkspace]
  )

  const handleItemDeleted = useCallback(
    ({ targetPath }) => {
      invalidate()
      removeFromNavigation(targetPath)
      removeFromWorkspace(targetPath)
    },
    [invalidate, removeFromNavigation, removeFromWorkspace]
  )

  const noticeElement = notice && (
    <div role="alert" className="app-notice">
      <span>{notice}</span>
      <button type="button" onClick={() => setNotice('')} aria-label={t.common.close}>
        ×
      </button>
    </div>
  )
  const profile = (
    <ProfileModal
      isOpen={profileTab !== null}
      onClose={closeProfile}
      preferences={preferences}
      languagePreference={languagePreference}
      onUpdatePreferences={updatePreferences}
      initialTab={profileTab ?? 'general'}
    />
  )

  if (!isEditing) {
    return (
      <Home
        currentLang={language}
        isDark={isDark}
        isSystemMode={preferences.mode === 'system'}
        onToggleTheme={toggleTheme}
        onToggleLanguage={toggleLanguage}
        onOpenProfile={openProfile}
        notice={noticeElement}
        showToast={showToast}
        workspace={workspace}
        workspaceSearch={workspaceSearch}
        openWorkspaceResult={openWorkspaceResult}
        navigation={navigation}
        onItemRenamed={handleItemRenamed}
        onItemDeleted={handleItemDeleted}
        addMenuOpen={addMenuOpen}
        setAddMenuOpen={setAddMenuOpen}
      >
        {profile}
      </Home>
    )
  }

  return (
    <>
      {noticeElement}
      <Editor
        key={activeDoc?.id || 'doc'}
        initialDoc={activeDoc}
        onSelectFile={selectFile}
        onOpenFile={openFileDialog}
        onBack={navigation.goHome}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        onOpenProfile={openProfile}
        openedFolder={activeFolder}
        openedFolders={folders}
        looseFiles={navigation.looseFiles}
        isZenMode={isZenMode}
        setIsZenMode={setIsZenMode}
        workspaceSearch={workspaceSearch}
        workspaceJump={workspaceJump}
        onOpenWorkspaceResult={openWorkspaceResult}
        onFinishWorkspaceJump={finishWorkspaceJump}
        onSavedFile={navigation.onSavedFile}
        onSwitchFolder={navigation.switchFolder}
        onRefreshFolderTree={refreshFolders}
        onCloseFolder={closeFolder}
        onOpenFolder={openFolder}
        onNewDoc={createDocument}
        onItemRenamed={handleItemRenamed}
        onItemDeleted={handleItemDeleted}
      />
      {profile}
    </>
  )
}
