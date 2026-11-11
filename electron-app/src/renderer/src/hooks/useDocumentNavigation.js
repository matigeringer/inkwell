import { useCallback, useEffect, useState } from 'react'
import {
  isSameOrDescendant,
  isWithinFolder,
  pathAfterRename,
  pathName,
  preferredFilePath
} from '../lib/workspaceTree'

const LOOSE_FILES_KEY = 'fountain_loose_files'

function loadLooseFiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOSE_FILES_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((path) => typeof path === 'string' && path) : []
  } catch {
    return []
  }
}

export default function useDocumentNavigation({
  language,
  folders,
  activateFolder,
  recentFiles,
  showToast
}) {
  const [activeDoc, setActiveDoc] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [workspaceJump, setWorkspaceJump] = useState(null)
  const [looseFiles, setLooseFiles] = useState(loadLooseFiles)
  const [looseFileError, setLooseFileError] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(LOOSE_FILES_KEY, JSON.stringify(looseFiles))
    } catch (error) {
      queueMicrotask(() => showToast(error.message))
    }
  }, [looseFiles, showToast])

  const rememberLooseFile = useCallback((path) => {
    if (path) setLooseFiles((files) => (files.includes(path) ? files : [...files, path]))
  }, [])

  const removeLooseFile = useCallback((path) => {
    setLooseFiles((files) => files.filter((file) => file !== path))
    setLooseFileError((error) => (error === path ? null : error))
  }, [])

  const openDraft = useCallback(
    (draft) => {
      setActiveDoc(draft)
      activateFolder(null)
      setWorkspaceJump(null)
      setIsEditing(true)
    },
    [activateFolder]
  )

  const createDocument = useCallback(() => {
    openDraft({
      id: crypto.randomUUID(),
      fileName: language === 'en' ? 'document.md' : 'documento.md',
      filePath: null,
      content: ''
    })
  }, [language, openDraft])

  const openDocument = useCallback(
    ({ filePath, fileName, content }, folderPath, jump = null) => {
      const owner =
        (folderPath && folders.find(({ path }) => path === folderPath)) ||
        folders.find(({ path }) => isWithinFolder(path, filePath))
      setActiveDoc({ id: filePath || crypto.randomUUID(), filePath, fileName, content })
      activateFolder(owner?.path ?? folderPath ?? null, filePath)
      if (!owner && !folderPath) rememberLooseFile(filePath)
      setLooseFileError(null)
      setWorkspaceJump(jump)
      setIsEditing(true)
    },
    [folders, activateFolder, rememberLooseFile]
  )

  const openFileDialog = useCallback(async () => {
    try {
      const result = await window.api?.openFileDialog?.()
      if (!result || result.canceled) return
      if (!result.success) throw new Error(result.error || 'No se pudo abrir el archivo')
      openDocument(result)
    } catch (error) {
      showToast(error.message)
    }
  }, [openDocument, showToast])

  const selectFile = useCallback(
    async (filePath, folderPath, jump) => {
      if (!window.api?.readFile) return false
      try {
        const result = await window.api.readFile(filePath)
        if (!result?.success) throw new Error(result?.error || 'No se pudo abrir el archivo')
        openDocument(result, folderPath, jump)
        return true
      } catch (error) {
        showToast(error.message)
        setLooseFileError(filePath)
        return false
      }
    },
    [openDocument, showToast]
  )

  const switchFolder = useCallback(
    async (targetPath, openedFolder) => {
      const target = openedFolder ?? folders.find(({ path }) => path === targetPath)
      if (!target) return
      activateFolder(target.path)
      if (isWithinFolder(target.path, activeDoc?.filePath)) return
      const filePath = preferredFilePath(target.tree, recentFiles.get(target.path))
      if (filePath) return selectFile(filePath, target.path)
    },
    [folders, activateFolder, activeDoc?.filePath, recentFiles, selectFile]
  )

  const onSavedFile = useCallback(
    (filePath, fileName, content) => {
      setActiveDoc((doc) => ({ ...doc, filePath, fileName, content }))
      if (!folders.some(({ path }) => isWithinFolder(path, filePath))) rememberLooseFile(filePath)
    },
    [folders, rememberLooseFile]
  )

  const renameItem = useCallback((rename) => {
    const update = (path) => pathAfterRename(path, rename)
    setLooseFiles((files) => files.map(update))
    setLooseFileError(update)
    setActiveDoc((doc) => {
      if (!doc?.filePath) return doc
      const filePath = update(doc.filePath)
      return filePath === doc.filePath ? doc : { ...doc, filePath, fileName: pathName(filePath) }
    })
  }, [])

  const removeItem = useCallback((targetPath) => {
    const removed = (path) => isSameOrDescendant(targetPath, path)
    setLooseFiles((files) => files.filter((path) => !removed(path)))
    setLooseFileError((path) => (removed(path) ? null : path))
    setActiveDoc((doc) => (removed(doc?.filePath) ? null : doc))
  }, [])

  const goHome = useCallback(() => setIsEditing(false), [])

  return {
    activeDoc,
    isEditing,
    looseFiles,
    looseFileError,
    workspaceJump,
    setWorkspaceJump,
    createDocument,
    openDraft,
    openFileDialog,
    selectFile,
    switchFolder,
    onSavedFile,
    removeLooseFile,
    renameItem,
    removeItem,
    goHome
  }
}
