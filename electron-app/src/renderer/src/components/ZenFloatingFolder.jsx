import useFileActions from '../hooks/useFileActions'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FilePlusIcon,
  FileTextIcon,
  FileMarkdownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  CloseIcon,
  TrashIcon,
  SearchIcon
} from './Icons'
import DeleteConfirmModal from './DeleteConfirmModal'
import { getTranslation } from '../i18n'

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') {
    return <FileMarkdownIcon size={15} className="zen-tree-file-icon" />
  }
  return <FileTextIcon size={15} className="zen-tree-file-icon" />
}

function countTotalFiles(items) {
  let count = 0
  if (!Array.isArray(items)) return count
  for (const it of items) {
    if (it.isDirectory) {
      count += countTotalFiles(it.children)
    } else {
      count += 1
    }
  }
  return count
}

// Filtrado recursivo cuando hay texto en el buscador
function filterTree(items, query) {
  if (!query) return items
  const q = query.toLowerCase()

  return items
    .map((item) => {
      if (item.isDirectory) {
        const matchingChildren = filterTree(item.children || [], query)
        const folderMatches = item.name.toLowerCase().includes(q)
        if (folderMatches || matchingChildren.length > 0) {
          return {
            ...item,
            children: matchingChildren
          }
        }
        return null
      } else {
        return item.name.toLowerCase().includes(q) ? item : null
      }
    })
    .filter(Boolean)
}

export default function ZenFloatingFolder({
  openedFolder,
  activeFilePath,
  onSelectFile,
  runMutation,
  onItemRenamed,
  onItemDeleted,
  onRefreshTree,
  onSearchFolder,
  hidden,
  showToast,
  isMouseActive,
  language = 'es'
}) {
  const { deleteItem } = useFileActions({ runMutation, onItemRenamed, onItemDeleted })
  const t = getTranslation(language)
  const isEn = language === 'en'

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingIn, setCreatingIn] = useState(null) // { parentPath, type: 'file' | 'folder' } | null
  const [creatingName, setCreatingName] = useState('')
  const [contextMenu, setContextMenu] = useState(null) // { x, y, item } | null
  const [deletingItem, setDeletingItem] = useState(null)
  const createInputRef = useRef(null)

  // Cerrar menú contextual al hacer clic fuera, scroll o Escape
  useEffect(() => {
    if (!contextMenu) return

    const handleGlobalClick = (e) => {
      if (!e.target.closest('.tree-context-menu')) {
        setContextMenu(null)
      }
    }

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('mousedown', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    window.addEventListener('scroll', handleGlobalClick, true)

    return () => {
      window.removeEventListener('mousedown', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('scroll', handleGlobalClick, true)
    }
  }, [contextMenu])

  // Expandir todas las subcarpetas inicialmente para acceso rápido
  const [expandedFolders, setExpandedFolders] = useState(() => {
    const set = new Set([openedFolder?.path])
    const addAllFolders = (items) => {
      if (!Array.isArray(items)) return
      for (const it of items) {
        if (it.isDirectory) {
          set.add(it.path)
          addAllFolders(it.children)
        }
      }
    }
    addAllFolders(openedFolder?.tree)
    return set
  })

  // Enfocar input al iniciar creación
  useEffect(() => {
    if (creatingIn && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [creatingIn])

  const totalFiles = useMemo(() => {
    return countTotalFiles(openedFolder?.tree)
  }, [openedFolder?.tree])

  const toggleFolder = (folderPath, e) => {
    e?.stopPropagation()
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }

  const handleStartCreate = (parentPath, type, e) => {
    e?.stopPropagation()
    setIsCollapsed(false)
    setSearchQuery('')
    setExpandedFolders((prev) => new Set(prev).add(parentPath))
    setCreatingIn({ parentPath, type })
    setCreatingName('')
    setContextMenu(null)
  }

  const handleCancelCreate = () => {
    setCreatingIn(null)
    setCreatingName('')
  }

  const handleConfirmCreate = async () => {
    if (!creatingIn) return
    const name = creatingName.trim()
    if (!name) {
      handleCancelCreate()
      return
    }

    try {
      if (creatingIn.type === 'file') {
        if (!window.api?.createFile) return
        const res = await window.api.createFile({
          parentPath: creatingIn.parentPath,
          fileName: name
        })
        if (res?.success) {
          showToast?.(t.fileTree.toastFileCreated(res.fileName))
          if (onRefreshTree) {
            await onRefreshTree()
          }
          if (onSelectFile && res.filePath) {
            onSelectFile(res.filePath)
          }
        } else {
          showToast?.(res?.error || t.fileTree.toastErrorCreateFile, 'error')
        }
      } else {
        if (!window.api?.createFolder) return
        const res = await window.api.createFolder({
          parentPath: creatingIn.parentPath,
          folderName: name
        })
        if (res?.success) {
          showToast?.(t.fileTree.toastFolderCreated(res.folderName))
          setExpandedFolders((prev) => new Set(prev).add(res.folderPath))
          if (onRefreshTree) {
            await onRefreshTree()
          }
        } else {
          showToast?.(res?.error || t.fileTree.toastErrorCreateFolder, 'error')
        }
      }
    } catch (err) {
      showToast?.(err.message || t.common.error, 'error')
    } finally {
      handleCancelCreate()
    }
  }

  const handleConfirmDelete = async (item) => {
    try {
      const res = await deleteItem(item.path)
      if (res?.success) {
        showToast?.(
          res.warning || t.fileTree.toastDeleted(item.name),
          res.warning ? 'error' : 'info'
        )
        await onRefreshTree?.()
      } else {
        showToast?.(res?.error || t.fileTree.toastErrorDelete, 'error')
      }
    } catch (err) {
      showToast?.(err.message || t.common.error, 'error')
    }
  }

  const handleContextMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 210
    const menuHeight = item?.isDirectory ? 160 : 120
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x = e.clientX
    let y = e.clientY

    if (x + menuWidth > viewportWidth) {
      x = Math.max(10, viewportWidth - menuWidth - 10)
    }
    if (y + menuHeight > viewportHeight) {
      y = Math.max(10, viewportHeight - menuHeight - 10)
    }

    setContextMenu({ x, y, item })
  }

  const displayedTree = useMemo(() => {
    if (!openedFolder?.tree) return []
    const q = searchQuery.trim()
    if (!q) return openedFolder.tree
    return filterTree(openedFolder.tree, q)
  }, [openedFolder?.tree, searchQuery])

  // Formulario en línea para creación rápida
  const renderInlineCreateForm = () => {
    if (!creatingIn) return null

    return (
      <div className="zen-tree-inline-form" onClick={(e) => e.stopPropagation()}>
        <div className="zen-tree-item-icon">
          {creatingIn.type === 'file' ? (
            <FileTextIcon size={15} className="zen-tree-file-icon" />
          ) : (
            <FolderIcon size={15} className="zen-tree-folder-icon" />
          )}
        </div>
        <input
          ref={createInputRef}
          type="text"
          className="zen-tree-inline-input"
          placeholder={
            creatingIn.type === 'file' ? t.fileTree.filePlaceholder : t.fileTree.folderPlaceholder
          }
          value={creatingName}
          onChange={(e) => setCreatingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirmCreate()
            if (e.key === 'Escape') handleCancelCreate()
          }}
        />
        <div className="zen-tree-inline-actions">
          <button
            type="button"
            className="btn-zen-tree-inline btn-zen-inline-check"
            onMouseDown={(e) => {
              e.preventDefault()
              handleConfirmCreate()
            }}
            onClick={handleConfirmCreate}
            title={isEn ? 'Create' : 'Crear'}
            aria-label={isEn ? 'Create' : 'Crear'}
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            className="btn-zen-tree-inline"
            onMouseDown={(e) => {
              e.preventDefault()
              handleCancelCreate()
            }}
            onClick={handleCancelCreate}
            title={t.common.cancel}
            aria-label={t.common.cancel}
          >
            <CloseIcon size={13} />
          </button>
        </div>
      </div>
    )
  }

  // Renderizador recursivo de árbol estilo explorador Zen
  const renderTreeNodes = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return (
        <div className="zen-tree-empty-folder">
          <span>{isEn ? 'Empty folder' : 'Carpeta vacía'}</span>
        </div>
      )
    }

    return items.map((item) => {
      if (item.isDirectory) {
        const isExpanded = expandedFolders.has(item.path) || Boolean(searchQuery.trim())
        const isCreatingInside = creatingIn?.parentPath === item.path

        return (
          <div key={item.path} className="zen-tree-node zen-tree-folder-node">
            <div
              className={`zen-tree-item zen-tree-folder-item ${isExpanded ? 'is-expanded' : ''}`}
              onClick={(e) => toggleFolder(item.path, e)}
              onContextMenu={(e) => handleContextMenu(e, item)}
              title={item.path}
            >
              <span className="zen-tree-caret">
                {isExpanded ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
              </span>
              <div className="zen-tree-item-icon">
                {isExpanded ? (
                  <FolderOpenIcon size={15} className="zen-tree-folder-icon is-open" />
                ) : (
                  <FolderIcon size={15} className="zen-tree-folder-icon" />
                )}
              </div>
              <span className="zen-tree-name zen-tree-folder-name">{item.name}</span>

              <div className="zen-tree-item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-zen-tree-action"
                  onClick={(e) => handleStartCreate(item.path, 'file', e)}
                  title={isEn ? 'New file in this folder' : 'Nuevo archivo en esta carpeta'}
                  aria-label={t.fileTree.newFile}
                >
                  <FilePlusIcon size={13} />
                </button>
                <button
                  type="button"
                  className="btn-zen-tree-action"
                  onClick={(e) => handleStartCreate(item.path, 'folder', e)}
                  title={isEn ? 'New folder in this folder' : 'Nueva carpeta en esta carpeta'}
                  aria-label={t.fileTree.newFolder}
                >
                  <FolderPlusIcon size={13} />
                </button>
                <button
                  type="button"
                  className="btn-zen-tree-action btn-action-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeletingItem(item)
                  }}
                  title={isEn ? 'Delete folder' : 'Eliminar carpeta'}
                  aria-label={t.fileTree.delete}
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="zen-tree-subgroup">
                {isCreatingInside && renderInlineCreateForm()}
                {item.children && item.children.length > 0 ? (
                  renderTreeNodes(item.children)
                ) : !isCreatingInside ? (
                  <div className="zen-tree-empty-folder">
                    <span>{isEn ? 'Empty folder' : 'Carpeta vacía'}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      }

      // Archivo / Nota
      const isActive = activeFilePath === item.path

      return (
        <div key={item.path} className="zen-tree-node zen-tree-file-node">
          <div
            className={`zen-tree-item zen-tree-file-item ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelectFile && onSelectFile(item.path)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            title={item.name}
          >
            <span className="zen-tree-caret-spacer" />
            <div className="zen-tree-item-icon">{getFileIcon(item.name)}</div>
            <span className="zen-tree-name zen-tree-file-name">{item.name}</span>
          </div>
        </div>
      )
    })
  }

  if (!openedFolder) return null

  const isCreatingInRoot = creatingIn?.parentPath === openedFolder.path
  const isPanelActive = isMouseActive || Boolean(creatingIn) || Boolean(contextMenu)

  return (
    <>
      <aside
        className={`zen-floating-folder ${isPanelActive ? 'visible' : ''} ${isCollapsed ? 'is-collapsed' : ''} ${creatingIn ? 'is-creating' : ''}`}
        aria-label="Explorador de notas en modo Zen"
        hidden={hidden}
      >
        {/* Cabecera / Pill de la carpeta flotante */}
        <header
          className="zen-folder-header"
          onClick={() => setIsCollapsed((prev) => !prev)}
          onContextMenu={(e) =>
            handleContextMenu(e, {
              isDirectory: true,
              path: openedFolder.path,
              name: openedFolder.name,
              isRoot: true
            })
          }
          title={
            isCollapsed ? (isEn ? 'Expand notes' : 'Desplegar notas') : isEn ? 'Collapse' : 'Plegar'
          }
        >
          <div className="zen-folder-header-left">
            <FolderIcon size={15} className="zen-folder-header-icon" />
            <span className="zen-folder-header-title">{openedFolder.name}</span>
          </div>
          <div className="zen-folder-header-actions" onClick={(e) => e.stopPropagation()}>
            {onSearchFolder && (
              <button
                type="button"
                className="btn-zen-folder-header-action"
                onClick={() =>
                  onSearchFolder({ path: openedFolder.path, rootPath: openedFolder.path })
                }
                title={`${t.workspaceSearch.title} (Ctrl+Alt+F)`}
                aria-label={t.workspaceSearch.title}
              >
                <SearchIcon size={14} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="btn-zen-folder-header-action"
              onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
              title={isEn ? 'New file in root' : 'Nuevo archivo en raíz'}
              aria-label={t.fileTree.newFile}
            >
              <FilePlusIcon size={14} />
            </button>
            <button
              type="button"
              className="btn-zen-folder-header-action"
              onClick={(e) => handleStartCreate(openedFolder.path, 'folder', e)}
              title={isEn ? 'New folder in root' : 'Nueva carpeta en raíz'}
              aria-label={t.fileTree.newFolder}
            >
              <FolderPlusIcon size={14} />
            </button>
            <button
              type="button"
              className="zen-folder-toggle-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsCollapsed((prev) => !prev)
              }}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
            </button>
          </div>
        </header>

        {/* Contenido expandido con buscador sutil y lista de notas */}
        {!isCollapsed && (
          <div className="zen-folder-body">
            {totalFiles > 5 && (
              <div className="zen-folder-search-wrap">
                <input
                  type="text"
                  className="zen-folder-search-input"
                  placeholder={isEn ? 'Filter notes...' : 'Filtrar notas...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div
              className="zen-folder-tree-scroll"
              onContextMenu={(e) => {
                if (!e.target.closest('.zen-tree-item')) {
                  handleContextMenu(e, {
                    isDirectory: true,
                    path: openedFolder.path,
                    name: openedFolder.name,
                    isRoot: true
                  })
                }
              }}
            >
              {isCreatingInRoot && renderInlineCreateForm()}
              {displayedTree.length > 0 ? (
                renderTreeNodes(displayedTree)
              ) : !isCreatingInRoot ? (
                searchQuery.trim() ? (
                  <div className="zen-tree-empty-search">
                    <span>{isEn ? 'No matching notes' : 'Sin notas coincidentes'}</span>
                  </div>
                ) : (
                  <div className="zen-tree-empty-state">
                    <p className="zen-tree-empty-text">
                      {isEn ? 'No files in this folder' : 'No hay notas en esta carpeta'}
                    </p>
                    <div className="zen-tree-empty-actions">
                      <button
                        type="button"
                        className="btn-zen-empty-action"
                        onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
                      >
                        <FilePlusIcon size={13} />
                        <span>{isEn ? 'New file' : 'Nuevo archivo'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-zen-empty-action"
                        onClick={(e) => handleStartCreate(openedFolder.path, 'folder', e)}
                      >
                        <FolderPlusIcon size={13} />
                        <span>{isEn ? 'New folder' : 'Nueva carpeta'}</span>
                      </button>
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        )}
      </aside>

      {/* Menú contextual flotante posicionado con portal */}
      {!hidden &&
        contextMenu &&
        createPortal(
          <div
            className="tree-context-menu"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.item?.isDirectory ? (
              <>
                {onSearchFolder && (
                  <button
                    type="button"
                    className="tree-context-menu-item"
                    onClick={() => {
                      onSearchFolder({ rootPath: openedFolder.path, path: contextMenu.item.path })
                      setContextMenu(null)
                    }}
                  >
                    <span className="tree-context-menu-icon">
                      <SearchIcon size={14} />
                    </span>
                    <span className="tree-context-menu-label">{t.workspaceSearch.inFolder}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="tree-context-menu-item"
                  onClick={(e) => {
                    const item = contextMenu.item
                    setContextMenu(null)
                    handleStartCreate(item.path, 'file', e)
                  }}
                >
                  <span className="tree-context-menu-icon">
                    <FilePlusIcon size={14} />
                  </span>
                  <span className="tree-context-menu-label">
                    {contextMenu.item.isRoot
                      ? isEn
                        ? 'New file in root'
                        : 'Nuevo archivo en raíz'
                      : t.fileTree.newFile}
                  </span>
                </button>

                <button
                  type="button"
                  className="tree-context-menu-item"
                  onClick={(e) => {
                    const item = contextMenu.item
                    setContextMenu(null)
                    handleStartCreate(item.path, 'folder', e)
                  }}
                >
                  <span className="tree-context-menu-icon">
                    <FolderPlusIcon size={14} />
                  </span>
                  <span className="tree-context-menu-label">
                    {contextMenu.item.isRoot
                      ? isEn
                        ? 'New folder in root'
                        : 'Nueva carpeta en raíz'
                      : t.fileTree.newFolder}
                  </span>
                </button>

                {!contextMenu.item.isRoot && (
                  <>
                    <div className="tree-context-menu-divider" />
                    <button
                      type="button"
                      className="tree-context-menu-item context-menu-danger"
                      onClick={() => {
                        const item = contextMenu.item
                        setContextMenu(null)
                        setDeletingItem(item)
                      }}
                    >
                      <span className="tree-context-menu-icon">
                        <TrashIcon size={14} />
                      </span>
                      <span className="tree-context-menu-label">{t.fileTree.delete}</span>
                    </button>
                  </>
                )}
              </>
            ) : contextMenu.item ? (
              <>
                <button
                  type="button"
                  className="tree-context-menu-item"
                  onClick={() => {
                    const item = contextMenu.item
                    setContextMenu(null)
                    onSelectFile?.(item.path)
                  }}
                >
                  <span className="tree-context-menu-icon">
                    <FileTextIcon size={14} />
                  </span>
                  <span className="tree-context-menu-label">{t.fileTree.openFile}</span>
                </button>

                <div className="tree-context-menu-divider" />

                <button
                  type="button"
                  className="tree-context-menu-item context-menu-danger"
                  onClick={() => {
                    const item = contextMenu.item
                    setContextMenu(null)
                    setDeletingItem(item)
                  }}
                >
                  <span className="tree-context-menu-icon">
                    <TrashIcon size={14} />
                  </span>
                  <span className="tree-context-menu-label">{t.fileTree.delete}</span>
                </button>
              </>
            ) : null}
          </div>,
          document.body
        )}

      {/* Modal de confirmación para eliminar carpeta o archivo */}
      {deletingItem &&
        createPortal(
          <DeleteConfirmModal
            isOpen={Boolean(deletingItem)}
            item={deletingItem}
            onConfirm={handleConfirmDelete}
            onClose={() => setDeletingItem(null)}
            language={language}
          />,
          document.body
        )}
    </>
  )
}
