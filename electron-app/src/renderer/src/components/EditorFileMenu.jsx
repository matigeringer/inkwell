import { ChevronDownIcon, CloseIcon, FileTextIcon, FolderIcon } from './Icons'
import { pathName } from '../lib/workspaceTree'

export default function EditorFileMenu({
  t,
  isOpen,
  setOpen,
  menuRef,
  openedFolder,
  openedFolders,
  looseFiles,
  filePath,
  fileName,
  onSelectFile,
  onSelectFolder,
  onCloseFolder,
  onOpenFile,
  onOpenFolder
}) {
  return (
    <div className={`header-folder-nav-group ${isOpen ? 'is-open' : ''}`} ref={menuRef}>
      {(openedFolder || filePath) && (
        <button
          type="button"
          className={`btn-header-folder ${isOpen ? 'active' : ''}`}
          onClick={() => setOpen((prev) => !prev)}
          title={t.editor.switchManuscript || 'Cambiar manuscrito'}
          aria-label={t.editor.switchManuscript || 'Cambiar manuscrito'}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {openedFolder ? (
            <FolderIcon size={16} className="header-folder-icon" />
          ) : (
            <FileTextIcon size={16} className="header-folder-icon" />
          )}
          <span className="header-folder-name">{openedFolder?.name || fileName}</span>
        </button>
      )}

      <button
        type="button"
        className={`btn-header-arrow ${isOpen ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        title={t.editor.switchManuscript || 'Cambiar manuscrito'}
        aria-label={t.editor.switchManuscript || 'Cambiar manuscrito'}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ChevronDownIcon size={13} className={`header-arrow-chevron ${isOpen ? 'is-open' : ''}`} />
      </button>

      {isOpen && (
        <div className="manuscripts-quick-dropdown" role="menu">
          {(openedFolders.length > 0 || looseFiles.length > 0) && (
            <div className="quick-dropdown-list">
              {looseFiles.map((path) => (
                <div
                  key={path}
                  className={`quick-dropdown-item ${!openedFolder && filePath === path ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="quick-dropdown-item-btn"
                    onClick={() => {
                      setOpen(false)
                      onSelectFile(path, null)
                    }}
                  >
                    <FileTextIcon size={14} className="dropdown-item-icon" />
                    <span className="dropdown-item-name" title={path}>
                      {pathName(path)}
                    </span>
                  </button>
                </div>
              ))}
              {openedFolders.map((folder) => {
                const isActive = folder.path === openedFolder?.path
                return (
                  <div
                    key={folder.path}
                    className={`quick-dropdown-item ${isActive ? 'is-active' : ''}`}
                  >
                    <button
                      type="button"
                      className="quick-dropdown-item-btn"
                      onClick={() => onSelectFolder(folder.path)}
                    >
                      <FolderIcon size={14} className="dropdown-item-icon" />
                      <span className="dropdown-item-name" title={folder.path}>
                        {folder.name}
                      </span>
                    </button>
                    {openedFolders.length > 1 && onCloseFolder && (
                      <button
                        type="button"
                        className="btn-dropdown-item-close"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCloseFolder(folder.path)
                        }}
                        title={t.fileTree.closeFolder}
                        aria-label={t.fileTree.closeFolder}
                      >
                        <CloseIcon size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="quick-dropdown-footer">
            <button
              type="button"
              className="quick-dropdown-new-btn"
              onClick={() => {
                setOpen(false)
                onOpenFile()
              }}
            >
              <FileTextIcon size={13} />
              <span>{t.home.openFile}</span>
            </button>
            <button type="button" className="quick-dropdown-new-btn" onClick={onOpenFolder}>
              <FolderIcon size={13} />
              <span>{t.home.openFolder}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
