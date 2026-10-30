import FileTree from './FileTree'
import { FileTextIcon, CloseIcon } from './Icons'
import { getTranslation } from '../i18n'

export default function ManuscriptsZone({
  openedFolders = [],
  looseFiles = [],
  looseFileError,
  onRemoveLooseFile,
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
      {looseFiles.length > 0 && (
        <div className="loose-files">
          {looseFiles.map((path) => (
            <div key={path}>
              <div className={`loose-file-row ${activeFilePath === path ? 'is-active' : ''}`}>
                <button type="button" className="loose-file-open" title={path} onClick={() => onSelectFile?.(path)}>
                  <FileTextIcon size={14} />
                  <span>{path.split(/[\\/]/).pop()}</span>
                </button>
                <button type="button" className="loose-file-remove" onClick={() => onRemoveLooseFile?.(path)} title={language === 'en' ? 'Remove shortcut' : 'Quitar acceso'} aria-label={language === 'en' ? `Remove shortcut to ${path}` : `Quitar acceso a ${path}`}><CloseIcon size={14} /></button>
              </div>
              {looseFileError === path && <p className="loose-file-error" role="alert">{language === 'en' ? 'Could not open this file. It may have been moved or deleted.' : 'No se pudo abrir el archivo. Puede que se haya movido o eliminado.'}</p>}
            </div>
          ))}
        </div>
      )}
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
      ) : looseFiles.length === 0 ? (
        <p className="sidebar-workspace-hint">{t.sidebar.workspaceHint}</p>
      ) : null}
    </div>
  )
}
