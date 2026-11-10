import { useCallback, useEffect, useRef, useState } from 'react'

export default function useWorkspaceSearch(openedFolders) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const [selectedScope, setScope] = useState(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const request = useRef(null)
  const timer = useRef(null)
  const returnFocus = useRef(null)
  const scope = openedFolders.some(({ path }) => path === selectedScope?.rootPath)
    ? selectedScope
    : null

  const cancelRequest = useCallback(() => {
    clearTimeout(timer.current)
    const active = request.current
    request.current = null
    if (active) window.api?.cancelFileSearch?.(active.id)?.catch(() => {})
  }, [])

  const invalidate = useCallback(() => {
    cancelRequest()
    setResult(null)
  }, [cancelRequest])

  const open = useCallback(
    (nextScope) => {
      if (!nextScope) return
      if (!document.activeElement?.closest('.workspace-search')) {
        returnFocus.current = document.activeElement
      }
      if (nextScope.path !== scope?.path || nextScope.rootPath !== scope.rootPath) {
        invalidate()
        setScope(nextScope)
        setQuery('')
      }
      setIsOpen(true)
      setFocusRequest((previous) => previous + 1)
    },
    [invalidate, scope]
  )

  const close = useCallback(
    ({ restoreFocus = true, fallback } = {}) => {
      cancelRequest()
      setIsOpen(false)
      setResult((previous) =>
        previous?.status === 'running' ? { ...previous, status: 'canceled' } : previous
      )
      if (restoreFocus) {
        returnFocus.current?.focus({ preventScroll: true })
        if (
          document.activeElement !== returnFocus.current ||
          document.activeElement === document.body
        ) {
          fallback?.focus({ preventScroll: true })
        }
      }
    },
    [cancelRequest]
  )

  useEffect(() => {
    if (!scope) cancelRequest()
  }, [scope, cancelRequest])

  useEffect(() => {
    const unsubscribe = window.api?.onFileSearchBatch?.(({ id, groups, ...progress }) => {
      if (request.current?.id !== id) return
      setResult((previous) =>
        previous?.id === id
          ? { ...previous, ...progress, groups: [...previous.groups, ...groups] }
          : previous
      )
    })
    return () => {
      unsubscribe?.()
      cancelRequest()
    }
  }, [cancelRequest])

  const start = async (text, getActiveFile) => {
    cancelRequest()
    if (!scope || !text.trim()) return

    const id = crypto.randomUUID()
    request.current = { id }
    setResult({ id, scope, status: 'running', groups: [] })
    let response
    try {
      response = await window.api?.searchFiles?.({
        id,
        scope,
        query: text,
        activeFile: getActiveFile?.() ?? null
      })
    } catch (error) {
      response = { error: error.message }
    }
    if (request.current?.id !== id) return
    const status = response?.success ? 'done' : response?.canceled ? 'canceled' : 'error'
    setResult((previous) => (previous?.id === id ? { ...previous, ...response, status } : previous))
  }

  const changeQuery = (text, getActiveFile) => {
    setQuery(text)
    invalidate()
    if (text.trim()) timer.current = setTimeout(() => start(text, getActiveFile), 200)
  }

  const selectMatch = useCallback((requestId, path, { block, offset }) => {
    setResult((previous) =>
      previous && previous.id === requestId
        ? { ...previous, selected: { path, block, offset } }
        : previous
    )
  }, [])

  return {
    isOpen: isOpen && Boolean(scope),
    scope,
    query,
    focusRequest,
    open,
    close,
    changeQuery,
    submit: (getActiveFile) => start(query, getActiveFile),
    selectMatch,
    invalidate,
    result: result?.scope === scope ? result : null
  }
}
