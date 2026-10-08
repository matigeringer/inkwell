import { useState, useMemo } from 'react'
import {
  FolderIcon,
  FolderOpenIcon,
  FileTextIcon,
  FileMarkdownIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from './Icons'

function getFileIcon(fileName) {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') {
    return <FileMarkdownIcon size={14} className="zen-tree-file-icon" />
  }
  return <FileTextIcon size={14} className="zen-tree-file-icon" />
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
  isMouseActive,
  language = 'es'
}) {
  const isEn = language === 'en'

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const displayedTree = useMemo(() => {
    if (!openedFolder?.tree) return []
    const q = searchQuery.trim()
    if (!q) return openedFolder.tree
    return filterTree(openedFolder.tree, q)
  }, [openedFolder?.tree, searchQuery])

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

        return (
          <div key={item.path} className="zen-tree-node zen-tree-folder-node">
            <div
              className={`zen-tree-item zen-tree-folder-item ${isExpanded ? 'is-expanded' : ''}`}
              onClick={(e) => toggleFolder(item.path, e)}
              title={item.path}
            >
              <span className="zen-tree-caret">
                {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
              </span>
              <div className="zen-tree-item-icon">
                {isExpanded ? (
                  <FolderOpenIcon size={14} className="zen-tree-folder-icon is-open" />
                ) : (
                  <FolderIcon size={14} className="zen-tree-folder-icon" />
                )}
              </div>
              <span className="zen-tree-name zen-tree-folder-name">{item.name}</span>
            </div>

            {isExpanded && (
              <div className="zen-tree-subgroup">
                {item.children && item.children.length > 0 ? (
                  renderTreeNodes(item.children)
                ) : (
                  <div className="zen-tree-empty-folder">
                    <span>{isEn ? 'Empty folder' : 'Carpeta vacía'}</span>
                  </div>
                )}
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

  return (
    <aside
      className={`zen-floating-folder ${isMouseActive ? 'visible' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label="Explorador de notas en modo Zen"
    >
      {/* Cabecera / Pill de la carpeta flotante */}
      <header
        className="zen-folder-header"
        onClick={() => setIsCollapsed((prev) => !prev)}
        title={
          isCollapsed ? (isEn ? 'Expand notes' : 'Desplegar notas') : isEn ? 'Collapse' : 'Plegar'
        }
      >
        <div className="zen-folder-header-left">
          <FolderIcon size={14} className="zen-folder-header-icon" />
          <span className="zen-folder-header-title">{openedFolder.name}</span>
        </div>
        <button
          type="button"
          className="zen-folder-toggle-btn"
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
        </button>
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

          <div className="zen-folder-tree-scroll">
            {displayedTree.length > 0 ? (
              renderTreeNodes(displayedTree)
            ) : (
              <div className="zen-tree-empty-search">
                <span>{isEn ? 'No matching notes' : 'Sin notas coincidentes'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
