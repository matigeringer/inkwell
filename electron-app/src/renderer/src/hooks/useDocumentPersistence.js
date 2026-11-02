import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DocumentSession } from '../lib/documentSession'
import { saveDraft, removeDraft } from '../lib/drafts'

export default function useDocumentPersistence({
  initialDoc,
  preferences,
  onSavedFile,
  onPersist,
  showToast
}) {
  const callbacks = useRef({ onSavedFile, onPersist, showToast })
  useEffect(() => {
    callbacks.current = { onSavedFile, onPersist, showToast }
  }, [onSavedFile, onPersist, showToast])
  const [session] = useState(
    () =>
      new DocumentSession(initialDoc, {
        api: window.api,
        saveDraft,
        removeDraft
      })
  )
  useEffect(() => {
    session.setOnPersist(async (result) => {
      if (result.filePath)
        callbacks.current.onSavedFile?.(result.filePath, result.fileName, result.content)
      try {
        await callbacks.current.onPersist?.(result)
      } catch (error) {
        callbacks.current.showToast?.(error.message, 'error')
      }
    })
  }, [session])
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const timer = useRef(null)
  const cancelAutoSave = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
  }, [])
  const reportError = useCallback((error) => {
    callbacks.current.showToast?.(error.message, 'error')
  }, [])
  const executeAutoSave = useCallback(async () => {
    try {
      return await session.flush()
    } catch (error) {
      reportError(error)
      return false
    }
  }, [session, reportError])

  useEffect(() => {
    cancelAutoSave()
    if (preferences.autoSaveEnabled !== false && state.revision !== state.persistedRevision) {
      timer.current = setTimeout(
        () => {
          executeAutoSave()
        },
        Math.min(60000, Math.max(250, preferences.autoSaveDelay || 2500))
      )
    }
    return cancelAutoSave
  }, [
    preferences.autoSaveEnabled,
    preferences.autoSaveDelay,
    state.revision,
    state.persistedRevision,
    cancelAutoSave,
    executeAutoSave
  ])

  const saveBeforeSwitch = useCallback(async () => {
    cancelAutoSave()
    return executeAutoSave()
  }, [cancelAutoSave, executeAutoSave])

  const save = useCallback(
    async (saveAs = false) => {
      cancelAutoSave()
      try {
        const saved = await session.save({ explicit: true, saveAs, trigger: 'manual' })
        if (saved)
          callbacks.current.showToast?.(
            `${preferences.language === 'en' ? 'Saved' : 'Guardado'}: ${session.state.fileName}`
          )
        return saved
      } catch (error) {
        reportError(error)
        return false
      }
    },
    [session, cancelAutoSave, reportError, preferences.language]
  )

  return {
    session,
    filePath: state.filePath,
    fileName: state.fileName,
    saveStatus: state.status,
    errorMessage: state.error,
    saveBeforeSwitch,
    cancelAutoSave,
    handleSave: useCallback(() => save(false), [save]),
    handleSaveAs: useCallback(() => save(true), [save])
  }
}
