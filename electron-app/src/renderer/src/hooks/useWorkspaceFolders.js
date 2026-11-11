import { useCallback, useEffect, useRef, useState } from 'react'
import { isSameOrDescendant, pathAfterRename, pathName, renameTreeItem } from '../lib/workspaceTree'

const FOLDERS_KEY = 'fountain_opened_folders'
const ACTIVE_FOLDER_KEY = 'fountain_active_folder'
const LEGACY_FOLDER_KEY = 'fountain_last_folder'

function loadFolderSelection() {
  let paths = []
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]')
    if (Array.isArray(saved)) paths = saved.filter((path) => typeof path === 'string' && path)
  } catch (error) {
    console.warn('Could not restore workspace folders:', error)
  }

  try {
    const lastPath = localStorage.getItem(LEGACY_FOLDER_KEY)
    return {
      paths: paths.length ? [...new Set(paths)] : lastPath ? [lastPath] : [],
      activePath: localStorage.getItem(ACTIVE_FOLDER_KEY)
    }
  } catch {
    return { paths, activePath: null }
  }
}

function folderFromResult({ folderPath, folderName, tree, warnings }) {
  return { path: folderPath, name: folderName, tree, warnings }
}

async function readFolder(path) {
  let error
  try {
    const result = await window.api.readFolderTree(path)
    if (result?.success) return folderFromResult(result)
    error = result?.error
  } catch (failure) {
    error = failure.message
  }
  return { path, name: pathName(path) || path, tree: [], error: error || 'Carpeta no disponible' }
}

export default function useWorkspaceFolders(showToast) {
  const [saved] = useState(loadFolderSelection)
  const [workspace, setWorkspace] = useState(() => ({
    folders: [],
    activePath: undefined,
    recentFiles: new Map(),
    restored: saved.paths.length === 0
  }))
  const { folders, activePath, recentFiles, restored } = workspace
  const requests = useRef(new Map())

  useEffect(() => {
    if (!saved.paths.length || !window.api?.readFolderTree) return
    let disposed = false
    Promise.all(saved.paths.map(readFolder)).then((restoredFolders) => {
      if (disposed) return
      setWorkspace((current) => {
        const known = new Map(restoredFolders.map((folder) => [folder.path, folder]))
        // A native dialog can finish while the saved folders are still loading.
        for (const folder of current.folders) known.set(folder.path, folder)
        const savedIndex = saved.paths.indexOf(saved.activePath)
        const initialPath = restoredFolders[savedIndex]?.path ?? known.keys().next().value
        return {
          ...current,
          folders: [...known.values()],
          activePath: current.activePath === undefined ? initialPath : current.activePath,
          restored: true
        }
      })
    })
    return () => {
      disposed = true
    }
  }, [saved])

  const lastPath = folders.at(-1)?.path
  const storedPaths = JSON.stringify(folders.map(({ path }) => path))
  useEffect(() => {
    if (!restored) return
    try {
      if (lastPath) {
        localStorage.setItem(FOLDERS_KEY, storedPaths)
        localStorage.setItem(LEGACY_FOLDER_KEY, lastPath)
      } else {
        localStorage.removeItem(FOLDERS_KEY)
        localStorage.removeItem(LEGACY_FOLDER_KEY)
      }
      if (activePath) localStorage.setItem(ACTIVE_FOLDER_KEY, activePath)
      else localStorage.removeItem(ACTIVE_FOLDER_KEY)
    } catch (error) {
      console.warn('Could not save workspace folders:', error)
    }
  }, [activePath, lastPath, restored, storedPaths])

  const activateFolder = useCallback((path, filePath) => {
    setWorkspace((current) => {
      const nextRecent =
        path && filePath ? new Map(current.recentFiles).set(path, filePath) : current.recentFiles
      if (current.activePath === path && nextRecent === current.recentFiles) return current
      return { ...current, activePath: path, recentFiles: nextRecent }
    })
  }, [])

  const openFolder = useCallback(async () => {
    try {
      const result = await window.api?.openFolder?.()
      if (!result || result.canceled) return null
      if (!result.success) throw new Error(result.error || 'No se pudo abrir la carpeta')

      const folder = folderFromResult(result)
      requests.current.delete(folder.path)
      setWorkspace((current) => ({
        ...current,
        activePath: folder.path,
        folders: current.folders.some(({ path }) => path === folder.path)
          ? current.folders.map((existing) => (existing.path === folder.path ? folder : existing))
          : [...current.folders, folder]
      }))
      return folder
    } catch (error) {
      showToast(error.message)
      return null
    }
  }, [showToast])

  const refreshFolders = useCallback(
    async (targetPath) => {
      if (!window.api?.readFolderTree) return
      const paths = targetPath ? [targetPath] : folders.map(({ path }) => path)
      const currentRequests = requests.current
      const results = await Promise.all(
        paths.map(async (path) => {
          const token = Symbol(path)
          currentRequests.set(path, token)
          return { path, token, folder: await readFolder(path) }
        })
      )
      const updates = new Map()
      for (const { path, token, folder } of results) {
        if (currentRequests.get(path) !== token) continue
        currentRequests.delete(path)
        updates.set(path, folder)
      }
      if (!updates.size) return

      setWorkspace((current) => {
        const active = updates.get(current.activePath)
        return {
          ...current,
          activePath: active?.path ?? current.activePath,
          folders: current.folders.map((folder) => updates.get(folder.path) ?? folder)
        }
      })
    },
    [folders]
  )

  const closeFolder = useCallback((path) => {
    requests.current.delete(path)
    setWorkspace((current) => {
      const index = current.folders.findIndex((folder) => folder.path === path)
      if (index === -1) return current
      const remaining = current.folders.filter((folder) => folder.path !== path)
      return {
        ...current,
        folders: remaining,
        activePath:
          current.activePath === path
            ? (remaining[Math.min(index, remaining.length - 1)]?.path ?? null)
            : current.activePath
      }
    })
  }, [])

  const renameItem = useCallback((rename) => {
    const update = (path) => pathAfterRename(path, rename)
    for (const path of requests.current.keys()) {
      if (isSameOrDescendant(rename.oldPath, path)) requests.current.delete(path)
    }
    setWorkspace((current) => ({
      ...current,
      activePath: update(current.activePath),
      recentFiles: new Map(
        [...current.recentFiles].map(([folder, file]) => [update(folder), update(file)])
      ),
      folders: current.folders.map((folder) => ({
        ...renameTreeItem(folder, rename),
        tree: folder.tree.map((item) => renameTreeItem(item, rename))
      }))
    }))
  }, [])

  const removeItem = useCallback((targetPath) => {
    const removed = (path) => isSameOrDescendant(targetPath, path)
    for (const path of requests.current.keys()) {
      if (removed(path)) requests.current.delete(path)
    }
    setWorkspace((current) => ({
      ...current,
      activePath: removed(current.activePath) ? null : current.activePath,
      recentFiles: new Map(
        [...current.recentFiles].filter(([folder, file]) => !removed(folder) && !removed(file))
      ),
      folders: current.folders.filter((folder) => !removed(folder.path))
    }))
  }, [])

  return {
    folders,
    activeFolder: folders.find((folder) => folder.path === activePath),
    recentFiles,
    activateFolder,
    openFolder,
    refreshFolders,
    closeFolder,
    renameItem,
    removeItem
  }
}
