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
  CloseIcon
} from './Icons'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function FileTree({
  openedFolder,
  activeFilePath,
  onSelectFile,
  onRefreshTree,
  onCloseFolder,
  showToast
}) {
  const [expandedFolders, setExpandedFolders] = useState(() => new Set([openedFolder?.path]))
  const [creatingIn, setCreatingIn] = useState(null) // { parentPath, type: 'file' | 'folder' } | null
  const [creatingName, setCreatingName] = useState('')
  const [renamingItem, setRenamingItem] = useState(null) // { path, name, isDirectory } | null
  const [renamingName, setRenamingName] = useState('')
  const [deletingItem, setDeletingItem] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const createInputRef = useRef(null)
  const renameInputRef = useRef(null)

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
        if (res.success) {
          showToast?.(`Archivo creado: ${res.fileName}`)
          await onRefreshTree()
          if (onSelectFile && res.filePath) {
            onSelectFile(res.filePath)
          }
        } else {
          showToast?.(res.error || 'Error al crear archivo', 'error')
        }
      } else {
        const res = await window.api.createFolder({
          parentPath: creatingIn.parentPath,
          folderName: name
        })
        if (res.success) {
          showToast?.(`Carpeta creada: ${res.folderName}`)
          // Auto-expandir la nueva carpeta
          setExpandedFolders((prev) => new Set(prev).add(res.folderPath))
          await onRefreshTree()
        } else {
          showToast?.(res.error || 'Error al crear carpeta', 'error')
        }
      }
    } catch (err) {
      showToast?.(err.message || 'Error inesperado', 'error')
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
      const res = await window.api.renameItem({
        oldPath: renamingItem.path,
        newName
      })

      if (res.success) {
        showToast?.(`Renombrado a: ${res.newName}`)
        await onRefreshTree()
        // Si el archivo renombrado es el activo, actualizar selección
        if (activeFilePath === renamingItem.path && onSelectFile) {
          onSelectFile(res.newPath)
        }
      } else {
        showToast?.(res.error || 'Error al renombrar', 'error')
      }
    } catch (err) {
      showToast?.(err.message || 'Error inesperado', 'error')
    } finally {
      handleCancelRename()
    }
  }

  const handleConfirmDelete = async (item) => {
    try {
      const res = await window.api.deleteItem(item.path)
      if (res.success) {
        showToast?.(`Eliminado: ${item.name}`)
        await onRefreshTree()
      } else {
        showToast?.(res.error || 'Error al eliminar', 'error')
      }
    } catch (err) {
      showToast?.(err.message || 'Error inesperado', 'error')
    }
  }

  const handleManualRefresh = async (e) => {
    e?.stopPropagation()
    setIsRefreshing(true)
    try {
      await onRefreshTree()
      showToast?.('Árbol actualizado')
    } catch {
      // Ignorar error
    } finally {
      setIsRefreshing(false)
    }
  }

  // Renderizador recursivo de elementos del árbol
  const renderTreeItems = (items, depth = 0) => {
    if (!items || items.length === 0) return null

    return (
      <div className="tree-group" style={{ '--tree-depth': depth }}>
        {items.map((item) => {
          const isDir = item.isDirectory
          const isExpanded = expandedFolders.has(item.path)
          const isActive = !isDir && activeFilePath === item.path
          const isItemRenaming = renamingItem?.path === item.path
          const isCreatingInside = creatingIn?.parentPath === item.path

          if (isDir) {
            return (
              <div key={item.path} className="tree-node tree-folder-node">
                {isItemRenaming ? (
                  <div className="tree-inline-form" onClick={(e) => e.stopPropagation()}>
                    <FolderIcon size={16} className="tree-icon" />
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
                      onBlur={handleConfirmRename}
                    />
                    <button
                      type="button"
                      className="btn-tree-inline"
                      onClick={handleConfirmRename}
                      title="Guardar"
                    >
                      <CheckIcon size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-tree-inline"
                      onClick={handleCancelRename}
                      title="Cancelar"
                    >
                      <CloseIcon size={13} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`tree-item tree-folder-item ${isExpanded ? 'is-expanded' : ''}`}
                    onClick={() => toggleFolder(item.path)}
                    title={item.path}
                  >
                    <button
                      type="button"
                      className="tree-chevron-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFolder(item.path)
                      }}
                      aria-label={isExpanded ? 'Plegar carpeta' : 'Desplegar carpeta'}
                    >
                      {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                    </button>

                    <div className="tree-item-icon">
                      {isExpanded ? (
                        <FolderOpenIcon size={16} className="folder-icon is-open" />
                      ) : (
                        <FolderIcon size={16} className="folder-icon" />
                      )}
                    </div>

                    <span className="tree-item-name">{item.name}</span>

                    {/* Acciones flotantes de la carpeta */}
                    <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartCreate(item.path, 'file', e)}
                        title="Nuevo archivo en esta carpeta"
                        aria-label="Nuevo archivo"
                      >
                        <FilePlusIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartCreate(item.path, 'folder', e)}
                        title="Nueva subcarpeta en esta carpeta"
                        aria-label="Nueva subcarpeta"
                      >
                        <FolderPlusIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tree-action"
                        onClick={(e) => handleStartRename(item, e)}
                        title="Renombrar carpeta"
                        aria-label="Renombrar"
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
                        title="Eliminar carpeta"
                        aria-label="Eliminar"
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
                          placeholder={creatingIn.type === 'file' ? 'nota.md' : 'nombre-carpeta'}
                          value={creatingName}
                          onChange={(e) => setCreatingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmCreate()
                            if (e.key === 'Escape') handleCancelCreate()
                          }}
                          onBlur={handleConfirmCreate}
                        />
                        <button
                          type="button"
                          className="btn-tree-inline"
                          onClick={handleConfirmCreate}
                          title="Crear"
                        >
                          <CheckIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-tree-inline"
                          onClick={handleCancelCreate}
                          title="Cancelar"
                        >
                          <CloseIcon size={13} />
                        </button>
                      </div>
                    )}

                    {item.children && item.children.length > 0
                      ? renderTreeItems(item.children, depth + 1)
                      : !isCreatingInside && (
                          <div className="tree-empty-folder">
                            <span>Carpeta vacía</span>
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
                    onBlur={handleConfirmRename}
                  />
                  <button
                    type="button"
                    className="btn-tree-inline"
                    onClick={handleConfirmRename}
                    title="Guardar"
                  >
                    <CheckIcon size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn-tree-inline"
                    onClick={handleCancelRename}
                    title="Cancelar"
                  >
                    <CloseIcon size={13} />
                  </button>
                </div>
              ) : (
                <div
                  className={`tree-item tree-file-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelectFile && onSelectFile(item.path)}
                  title={item.path}
                >
                  <div className="tree-item-icon">
                    <FileTextIcon size={15} className="file-icon" />
                  </div>

                  <span className="tree-item-name">{item.name}</span>

                  <div className="tree-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-tree-action"
                      onClick={(e) => handleStartRename(item, e)}
                      title="Renombrar archivo"
                      aria-label="Renombrar"
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
                      title="Eliminar archivo"
                      aria-label="Eliminar"
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
      {/* Cabecera del Espacio de Trabajo */}
      <div className="file-tree-header">
        <div className="tree-workspace-title-row" title={openedFolder.path}>
          <FolderIcon size={16} className="workspace-folder-icon" />
          <span className="tree-workspace-name">{openedFolder.name}</span>
        </div>

        <div className="tree-header-actions">
          <button
            type="button"
            className="btn-tree-header-icon"
            onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
            title="Nuevo archivo en raíz"
            aria-label="Nuevo archivo"
          >
            <FilePlusIcon size={14} />
          </button>
          <button
            type="button"
            className="btn-tree-header-icon"
            onClick={(e) => handleStartCreate(openedFolder.path, 'folder', e)}
            title="Nueva subcarpeta en raíz"
            aria-label="Nueva subcarpeta"
          >
            <FolderPlusIcon size={14} />
          </button>
          <button
            type="button"
            className={`btn-tree-header-icon ${isRefreshing ? 'animate-spin' : ''}`}
            onClick={handleManualRefresh}
            title="Actualizar explorador"
            aria-label="Actualizar"
          >
            <RefreshIcon size={14} />
          </button>
          <button
            type="button"
            className="btn-tree-header-icon btn-action-danger"
            onClick={onCloseFolder}
            title="Cerrar carpeta de trabajo"
            aria-label="Cerrar carpeta"
          >
            <FolderCloseIcon size={14} />
          </button>
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
              placeholder={creatingIn.type === 'file' ? 'nuevo-documento.md' : 'nueva-carpeta'}
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate()
                if (e.key === 'Escape') handleCancelCreate()
              }}
              onBlur={handleConfirmCreate}
            />
            <button
              type="button"
              className="btn-tree-inline"
              onClick={handleConfirmCreate}
              title="Crear"
            >
              <CheckIcon size={13} />
            </button>
            <button
              type="button"
              className="btn-tree-inline"
              onClick={handleCancelCreate}
              title="Cancelar"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        )}

        {openedFolder.tree && openedFolder.tree.length > 0
          ? renderTreeItems(openedFolder.tree, 0)
          : !isCreatingInRoot && (
              <div className="tree-empty-state">
                <p className="tree-empty-text">No hay archivos Markdown en esta carpeta.</p>
                <button
                  type="button"
                  className="btn-tree-empty-action"
                  onClick={(e) => handleStartCreate(openedFolder.path, 'file', e)}
                >
                  <FilePlusIcon size={14} />
                  <span>Crear primer archivo</span>
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
      />
    </div>
  )
}
