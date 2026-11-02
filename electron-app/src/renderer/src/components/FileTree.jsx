import useFileActions from '../hooks/useFileActions'
import { useState, useRef, useEffect } from 'react'
import {
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FilePlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FileTextIcon,
  TrashIcon,
  PencilIcon,
  RefreshIcon,
  FolderCloseIcon,
  CheckIcon,
  CloseIcon,
  FilePdfIcon,
  FileDocxIcon,
  FileOdtIcon,
  FileMarkdownIcon
} from './Icons'
import DeleteConfirmModal from './DeleteConfirmModal'
import { getTranslation } from '../i18n'

function getTreeFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') {
    return <FileMarkdownIcon size={14} className="file-icon" />
  }
  return <FileTextIcon size={14} className="file-icon" />
}

export default function FileTree({
  openedFolder,
  activeFilePath,
  onSelectFile,
  runMutation,
  onItemRenamed,
  onItemDeleted,
  onRefreshTree,
  onCloseFolder,
  showToast,
  language = 'es'
}) {
  const { renameItem, deleteItem } = useFileActions({ runMutation, onItemRenamed, onItemDeleted })
  const t = getTranslation(language)
  const isEn = language === 'en'

  const [expandedFolders, setExpandedFolders] = useState(() => new Set([openedFolder?.path]))
  const [creatingIn, setCreatingIn] = useState(null) // { parentPath, type: 'file' | 'folder' } | null
  const [creatingName, setCreatingName] = useState('')
  const [renamingItem, setRenamingItem] = useState(null) // { path, name, isDirectory } | null
  const [renamingName, setRenamingName] = useState('')
  const [deletingItem, setDeletingItem] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, item } | null

  const createInputRef = useRef(null)
  const renameInputRef = useRef(null)

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

  // Enfocar input al iniciar creación
  useEffect(() => {
    if (creatingIn && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [creatingIn])

  // Enfocar input al iniciar renombrado
  useEffect(() => {
    if (renamingItem && renameInputRef.current) {
      renameInputRef.current.focus()
      // Seleccionar nombre sin extensión si es archivo
      const dotIndex = renamingItem.name.lastIndexOf('.')
      if (!renamingItem.isDirectory && dotIndex > 0) {
        renameInputRef.current.setSelectionRange(0, dotIndex)
      } else {
        renameInputRef.current.select()
      }
    }
  }, [renamingItem])

  const toggleFolder = (folderPath) => {
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
    // Asegurar que la carpeta padre esté expandida
    setExpandedFolders((prev) => new Set(prev).add(parentPath))
    setCreatingIn({ parentPath, type })
    setCreatingName('')
    setRenamingItem(null)
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
        const res = await window.api.createFile({
          parentPath: creatingIn.parentPath,
          fileName: name
        })
        if (res?.success) {
          showToast?.(t.fileTree.toastFileCreated(res.fileName))
          await onRefreshTree()
          if (onSelectFile && res.filePath) {
            onSelectFile(res.filePath)
          }
        } else {
          showToast?.(res?.error || t.fileTree.toastErrorCreateFile, 'error')
        }
      } else {
        const res = await window.api.createFolder({
          parentPath: creatingIn.parentPath,
          folderName: name
        })
        if (res?.success) {
          showToast?.(t.fileTree.toastFolderCreated(res.folderName))
          // Auto-expandir la nueva carpeta
          setExpandedFolders((prev) => new Set(prev).add(res.folderPath))
          await onRefreshTree()
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

  const handleStartRename = (item, e) => {
    e?.stopPropagation()
    setRenamingItem(item)
    setRenamingName(item.name)
    setCreatingIn(null)
  }

  const handleCancelRename = () => {
    setRenamingItem(null)
    setRenamingName('')
  }

  const handleConfirmRename = async () => {
    if (!renamingItem) return
    const newName = renamingName.trim()
    if (!newName || newName === renamingItem.name) {
      handleCancelRename()
      return
    }

    try {
      const res = await renameItem({
        oldPath: renamingItem.path,
        newName
      })

      if (res?.success) {
        showToast?.(
          res.warning || t.fileTree.toastRenamed(res.newName),
          res.warning ? 'error' : 'info'
        )
        await onRefreshTree()
      } else {
        showToast?.(res?.error || t.fileTree.toastErrorRename, 'error')
      }
    } catch (err) {
      showToast?.(err.message || t.common.error, 'error')
    } finally {
      handleCancelRename()
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
        await onRefreshTree()
      } else {
        showToast?.(res?.error || t.fileTree.toastErrorDelete, 'error')
      }
    } catch (err) {
      showToast?.(err.message || t.common.error, 'error')
    }
  }

  const handleManualRefresh = async (e) => {
    e?.stopPropagation()
    setIsRefreshing(true)
    try {
      await onRefreshTree()
      showToast?.(isEn ? 'File tree refreshed' : 'Árbol actualizado')
    } catch {
      // Ignorar error
    } finally {
      setIsRefreshing(false)
    }
  }

  // Exportar archivo individual en formato seleccionado desde el explorador
  const handleExportDocument = async (item, format = 'pdf') => {
    if (!window.api?.exportDocument || !item?.path) return

    const formatNameMap = {
      pdf: 'PDF',
      docx: 'Word (.docx)',
      odt: 'OpenDocument (.odt)',
      markdown: 'Markdown (.md)',
      txt: 'Texto (.txt)'
    }
    const formatName = formatNameMap[format] || format.toUpperCase()

    try {
      showToast?.(isEn ? `Generating ${formatName}...` : `Generando archivo ${formatName}...`)
      const res = await window.api.exportDocument({
        format,
        filePath: item.path,
        fileName: item.name
      })

      if (res?.canceled) {
        return
      }

      if (res?.success) {
        showToast?.(isEn ? `Exported: ${res.fileName}` : `Exportado: ${res.fileName}`)
      } else {
        showToast?.(
          res?.error || (isEn ? 'Error exporting file' : 'Error al exportar archivo'),
          'error'
        )
      }
    } catch (err) {
      showToast?.(err.message || (isEn ? 'Error exporting' : 'Error al exportar'), 'error')
    }
  }

  // Alias retrocompatible
  const handleExportPdf = (item) => handleExportDocument(item, 'pdf')

  // Abrir menú contextual nativo/flotante posicionado
  const handleContextMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 210
    const menuHeight = item.isDirectory ? 180 : 210
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

  // Renderizador recursivo de elementos del árbol
  const renderTreeItems = (items, depth = 0) => {
    return (
      <div className="tree-level" style={{ '--depth': depth }}>
        {items.map((item) => {
          const isDir = item.isDirectory
          const isExpanded = expandedFolders.has(item.path)
          const isActive = activeFilePath === item.path
          const isItemRenaming = renamingItem?.path === item.path
          const isCreatingInside = creatingIn?.parentPath === item.path

          if (isDir) {
            return (
              <div key={item.path} className="tree-node tree-folder-node">
                {isItemRenaming ? (
                  <div className="tree-inline-form" onClick={(e) => e.stopPropagation()}>
                    <FolderIcon size={15} className="tree-icon" />
                    <input
                      ref={renameInputRef}
                      type="text"
                      className="tree-inline-input"
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename()
                        if (e.key === 'Escape') handleCancelRename()
                      }}
                    />
                    <button
                      type="button"
                      className="btn-tree-inline"
                      onClick={handleConfirmRename}
                      title={t.common.save}
                    >
                      <CheckIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-tree-inline"
                      onClick={handleCancelRename}
                      title={t.common.cancel}
                    >
                      <CloseIcon size={13} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="tree-item tree-folder-item"
                    onClick={() => toggleFolder(item.path)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    title={item.path}
                  >
                    <span className="tree-folder-caret">
                      {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                    </span>

                    <div className="tree-item-icon">
                      {isExpanded ? (
                        <FolderOpenIcon size={15} className="folder-icon folder-icon-open" />
                      ) : (
                        <FolderIcon size={15} className="folder-icon" />
                      )}
                    </div>

                    <span className="tree-item-name">{item.name}</span>

                    <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartCreate(item.path, 'file', e)}
                        title={isEn ? 'New file in this folder' : 'Nuevo archivo en esta carpeta'}
                        aria-label={t.fileTree.newFile}
                      >
                        <FilePlusIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartCreate(item.path, 'folder', e)}
                        title={
                          isEn ? 'New subfolder in this folder' : 'Nueva subcarpeta en esta carpeta'
                        }
                        aria-label={t.fileTree.newFolder}
                      >
                        <FolderPlusIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartRename(item, e)}
                        title={isEn ? 'Rename folder' : 'Renombrar carpeta'}
                        aria-label={t.fileTree.rename}
                      >
                        <PencilIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tree-action btn-action-danger"
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
                )}

                {/* Subcontenido de la carpeta desplegada */}
                {isExpanded && (
                  <div className="tree-subgroup">
                    {/* Formulario en línea para nuevo archivo o subcarpeta dentro de esta carpeta */}
                    {isCreatingInside && (
                      <div className="tree-inline-form" onClick={(e) => e.stopPropagation()}>
                        {creatingIn.type === 'file' ? (
                          <FileTextIcon size={15} className="tree-icon" />
                        ) : (
                          <FolderIcon size={15} className="tree-icon" />
                        )}
                        <input
                          ref={createInputRef}
                          type="text"
                          className="tree-inline-input"
                          placeholder={
                            creatingIn.type === 'file'
                              ? t.fileTree.filePlaceholder
                              : t.fileTree.folderPlaceholder
                          }
                          value={creatingName}
                          onChange={(e) => setCreatingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmCreate()
                            if (e.key === 'Escape') handleCancelCreate()
                          }}
                        />
                        <button
                          type="button"
                          className="btn-tree-inline"
                          onClick={handleConfirmCreate}
                          title={isEn ? 'Create' : 'Crear'}
                        >
                          <CheckIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-tree-inline"
                          onClick={handleCancelCreate}
                          title={t.common.cancel}
                        >
                          <CloseIcon size={13} />
                        </button>
                      </div>
                    )}

                    {item.children && item.children.length > 0
                      ? renderTreeItems(item.children, depth + 1)
                      : !isCreatingInside && (
                          <div className="tree-empty-folder">
                            <span>{isEn ? 'Empty folder' : 'Carpeta vacía'}</span>
                          </div>
                        )}
                  </div>
                )}
              </div>
            )
          }

          // Archivo Markdown / Texto
          return (
            <div key={item.path} className="tree-node tree-file-node">
              {isItemRenaming ? (
                <div className="tree-inline-form" onClick={(e) => e.stopPropagation()}>
                  <FileTextIcon size={15} className="tree-icon" />
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="tree-inline-input"
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename()
                      if (e.key === 'Escape') handleCancelRename()
                    }}
                  />
                  <button
                    type="button"
                    className="btn-tree-inline"
                    onClick={handleConfirmRename}
                    title={t.common.save}
                  >
                    <CheckIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-tree-inline"
                    onClick={handleCancelRename}
                    title={t.common.cancel}
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
              ) : (
                <div
                  className={`tree-item tree-file-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelectFile && onSelectFile(item.path)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  title={item.path}
                >
                  <span className="tree-folder-caret-spacer" />
                  <div className="tree-item-icon">{getTreeFileIcon(item.name)}</div>

                  <span className="tree-item-name">{item.name}</span>

                  <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-tree-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExportPdf(item)
                      }}
                      title={t.fileTree.exportPdf || (isEn ? 'Export to PDF' : 'Exportar a PDF')}
                      aria-label={
                        t.fileTree.exportPdf || (isEn ? 'Export to PDF' : 'Exportar a PDF')
                      }
                    >
                      <FilePdfIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-tree-action"
                      onClick={(e) => handleStartRename(item, e)}
                      title={isEn ? 'Rename file' : 'Renombrar archivo'}
                      aria-label={t.fileTree.rename}
                    >
                      <PencilIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-tree-action btn-action-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingItem(item)
                      }}
                      title={isEn ? 'Delete file' : 'Eliminar archivo'}
                      aria-label={t.fileTree.delete}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!openedFolder) return null

  const isCreatingInRoot = creatingIn?.parentPath === openedFolder.path

  return (
    <div className="file-tree-container">
      {openedFolder.error && (
        <p role="alert" className="tree-load-warning">
          {openedFolder.error}
        </p>
      )}
      {openedFolder.warnings?.length > 0 && (
        <p role="status" className="tree-load-warning">
          {openedFolder.warnings.join(' · ')}
        </p>
      )}
      {/* Cabecera del Espacio de Trabajo */}
      <div className="file-tree-header">
        <div className="tree-workspace-title-row">
          <div className="tree-workspace-info" title={openedFolder.path}>
            <FolderIcon size={15} className="workspace-folder-icon" />
            <span className="tree-workspace-name">{openedFolder.name}</span>
          </div>

          <div className="tree-header-actions">
            <button
              type="button"
              className="btn-tree-header-icon"
              onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
              title={isEn ? 'New file in root' : 'Nuevo archivo en raíz'}
              aria-label={t.fileTree.newFile}
            >
              <FilePlusIcon size={13} />
            </button>
            <button
              type="button"
              className="btn-tree-header-icon"
              onClick={(e) => handleStartCreate(openedFolder.path, 'folder', e)}
              title={isEn ? 'New subfolder in root' : 'Nueva subcarpeta en raíz'}
              aria-label={t.fileTree.newFolder}
            >
              <FolderPlusIcon size={13} />
            </button>
            <button
              type="button"
              className={`btn-tree-header-icon ${isRefreshing ? 'animate-spin' : ''}`}
              onClick={handleManualRefresh}
              title={t.fileTree.refresh}
              aria-label={t.fileTree.refresh}
            >
              <RefreshIcon size={13} />
            </button>
            <button
              type="button"
              className="btn-tree-header-icon btn-action-danger"
              onClick={onCloseFolder}
              title={t.fileTree.closeFolder}
              aria-label={t.fileTree.closeFolder}
            >
              <FolderCloseIcon size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo del Árbol de Archivos */}
      <div className="file-tree-body">
        {/* Formulario en raíz si se está creando algo */}
        {isCreatingInRoot && (
          <div className="tree-inline-form root-inline-form" onClick={(e) => e.stopPropagation()}>
            {creatingIn.type === 'file' ? (
              <FileTextIcon size={15} className="tree-icon" />
            ) : (
              <FolderIcon size={15} className="tree-icon" />
            )}
            <input
              ref={createInputRef}
              type="text"
              className="tree-inline-input"
              placeholder={
                creatingIn.type === 'file'
                  ? t.fileTree.filePlaceholder
                  : t.fileTree.folderPlaceholder
              }
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate()
                if (e.key === 'Escape') handleCancelCreate()
              }}
            />
            <button
              type="button"
              className="btn-tree-inline"
              onClick={handleConfirmCreate}
              title={isEn ? 'Create' : 'Crear'}
            >
              <CheckIcon size={13} />
            </button>
            <button
              type="button"
              className="btn-tree-inline"
              onClick={handleCancelCreate}
              title={t.common.cancel}
            >
              <CloseIcon size={13} />
            </button>
          </div>
        )}

        {openedFolder.tree && openedFolder.tree.length > 0
          ? renderTreeItems(openedFolder.tree, 0)
          : !isCreatingInRoot && (
              <div className="tree-empty-state">
                <p className="tree-empty-text">
                  {isEn
                    ? 'No Markdown files found in this folder.'
                    : 'No hay archivos Markdown en esta carpeta.'}
                </p>
                <button
                  type="button"
                  className="btn-tree-empty-action"
                  onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
                >
                  <FilePlusIcon size={14} />
                  <span>{isEn ? 'Create first file' : 'Crear primer archivo'}</span>
                </button>
              </div>
            )}
      </div>

      {/* Modal de confirmación de eliminación */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingItem)}
        item={deletingItem}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingItem(null)}
        language={language}
      />

      {/* Menú contextual flotante para archivos y carpetas */}
      {contextMenu && (
        <div
          className="tree-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.item.isDirectory ? (
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
                  <FileTextIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.openFile}</span>
              </button>

              <div className="tree-context-menu-divider" />

              <div className="tree-context-menu-header">
                {isEn ? 'Export to...' : 'Exportar a...'}
              </div>

              <button
                type="button"
                className="tree-context-menu-item context-menu-primary"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleExportDocument(item, 'pdf')
                }}
              >
                <span className="tree-context-menu-icon">
                  <FilePdfIcon size={15} />
                </span>
                <span className="tree-context-menu-label">
                  {isEn ? 'PDF Document (.pdf)' : 'Documento PDF (.pdf)'}
                </span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleExportDocument(item, 'docx')
                }}
              >
                <span className="tree-context-menu-icon">
                  <FileDocxIcon size={15} />
                </span>
                <span className="tree-context-menu-label">
                  {isEn ? 'Microsoft Word (.docx)' : 'Microsoft Word (.docx)'}
                </span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleExportDocument(item, 'odt')
                }}
              >
                <span className="tree-context-menu-icon">
                  <FileOdtIcon size={15} />
                </span>
                <span className="tree-context-menu-label">
                  {isEn ? 'OpenDocument (.odt)' : 'OpenDocument (.odt)'}
                </span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleExportDocument(item, 'markdown')
                }}
              >
                <span className="tree-context-menu-icon">
                  <FileMarkdownIcon size={15} />
                </span>
                <span className="tree-context-menu-label">
                  {isEn ? 'Markdown (.md)' : 'Markdown (.md)'}
                </span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleExportDocument(item, 'txt')
                }}
              >
                <span className="tree-context-menu-icon">
                  <FileTextIcon size={15} />
                </span>
                <span className="tree-context-menu-label">
                  {isEn ? 'Plain Text (.txt)' : 'Texto Plano (.txt)'}
                </span>
              </button>

              <div className="tree-context-menu-divider" />

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={(e) => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleStartRename(item, e)
                }}
              >
                <span className="tree-context-menu-icon">
                  <PencilIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.rename}</span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  window.api?.showInFolder?.(item.path)
                }}
              >
                <span className="tree-context-menu-icon">
                  <FolderOpenIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.showInFolder}</span>
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
                  <TrashIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.delete}</span>
              </button>
            </>
          ) : (
            <>
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
                  <FilePlusIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.newFile}</span>
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
                  <FolderPlusIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.newFolder}</span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={(e) => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  handleStartRename(item, e)
                }}
              >
                <span className="tree-context-menu-icon">
                  <PencilIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.rename}</span>
              </button>

              <button
                type="button"
                className="tree-context-menu-item"
                onClick={() => {
                  const item = contextMenu.item
                  setContextMenu(null)
                  window.api?.showInFolder?.(item.path)
                }}
              >
                <span className="tree-context-menu-icon">
                  <FolderOpenIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.showInFolder}</span>
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
                  <TrashIcon size={15} />
                </span>
                <span className="tree-context-menu-label">{t.fileTree.delete}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
