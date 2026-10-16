import FileTree from './FileTree'
import { getTranslation } from '../i18n'

export default function ManuscriptsZone({
  openedFolders = [],
  activeFilePath = null,
  onSelectFile,
  onRefreshFolderTree,
  onCloseFolder,
  showToast,
  language = 'es'
}) {
  const t = getTranslation(language)

  return (
    <div className="manuscripts-zone">
      {openedFolders.length > 0 ? (
        openedFolders.map((folder, index) => (
          <div key={folder.path} className="manuscript-folder-block">
            {index > 0 && <div className="manuscript-folder-separator" />}
            <FileTree
              openedFolder={folder}
              activeFilePath={activeFilePath}
              onSelectFile={(filePath) => onSelectFile?.(filePath, folder.path)}
              onRefreshTree={() => onRefreshFolderTree?.(folder.path)}
              onCloseFolder={() => onCloseFolder?.(folder.path)}
              showToast={showToast}
              language={language}
            />
          </div>
        ))
      ) : (
        <p className="sidebar-workspace-hint">{t.sidebar.workspaceHint}</p>
      )}
    </div>
  )
}
