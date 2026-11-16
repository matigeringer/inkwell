import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAnchorFromPmRange,
  createAnchorFromTextOffsets,
  extractPlainDocumentText,
  findWordRangeAtOffset,
  flatOffsetToPmPos,
  getMappedCommentRanges,
  pmPosToFlatOffset,
  resolveAnchorInText,
  resolveThreadsInDoc,
  syncCommentHighlights
} from '../lib/documentComments'

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export default function useDocumentComments({
  docKey,
  docName,
  filePath,
  editor,
  isSourceMode,
  source,
  sourceRef,
  visible,
  onSetVisible,
  showToast
}) {
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [hoveredThreadId, setHoveredThreadId] = useState(null)
  const [draftAnchor, setDraftAnchor] = useState(null)
  const [addingToThreadId, setAddingToThreadId] = useState(null)
  const [loadedKey, setLoadedKey] = useState(null)

  const threadsRef = useRef(threads)
  const docMetaRef = useRef({ docKey, docName, filePath })
  useEffect(() => {
    threadsRef.current = threads
  }, [threads])
  useEffect(() => {
    docMetaRef.current = { docKey, docName, filePath }
  }, [docKey, docName, filePath])

  const dirtyRef = useRef(false)
  const saveTimerRef = useRef(null)
  const requestedKeyRef = useRef(null)
  const pendingMoveRef = useRef(null)

  const getCurrentPlainText = useCallback(() => {
    if (isSourceMode) return source ?? ''
    if (editor && !editor.isDestroyed) return extractPlainDocumentText(editor.state.doc)
    return ''
  }, [editor, isSourceMode, source])

  const refreshThreadAnchors = useCallback(
    (list) => {
      if (!list.length) return list
      const text = getCurrentPlainText()
      if (!isSourceMode && editor && !editor.isDestroyed) {
        const mapped = getMappedCommentRanges(editor)
        const mappedById = new Map(mapped.map((item) => [item.threadId, item]))
        return list.map((thread) => {
          const item = mappedById.get(thread.id)
          if (!item || item.orphaned) return thread
          return {
            ...thread,
            anchor: createAnchorFromPmRange(editor.state.doc, item.from, item.to)
          }
        })
      }
      return list.map((thread) => {
        const resolved = resolveAnchorInText(text, thread.anchor)
        if (resolved.orphaned) return thread
        return {
          ...thread,
          anchor: createAnchorFromTextOffsets(text, resolved.fromOffset, resolved.toOffset)
        }
      })
    },
    [editor, getCurrentPlainText, isSourceMode]
  )

  const persistNow = useCallback(async () => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    if (!dirtyRef.current) return true
    const { docKey: key, docName: name, filePath: path } = docMetaRef.current
    if (!key || !window.api?.commentsSave) {
      dirtyRef.current = false
      return true
    }
    const updatedThreads = refreshThreadAnchors(threadsRef.current)
    threadsRef.current = updatedThreads
    setThreads(updatedThreads)
    dirtyRef.current = false
    const res = await window.api.commentsSave({
      docKey: key,
      docName: name,
      filePath: path,
      threads: updatedThreads
    })
    if (res && !res.success && res.error) {
      showToast?.(res.error, 'error')
      return false
    }
    return true
  }, [refreshThreadAnchors, showToast])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      persistNow().catch((err) => showToast?.(err.message, 'error'))
    }, 350)
  }, [persistNow, showToast])

  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Load comments when docKey changes unless we just moved the active key in-place.
  useEffect(() => {
    if (!docKey) return
    if (pendingMoveRef.current === docKey) {
      pendingMoveRef.current = null
      requestedKeyRef.current = docKey
      Promise.resolve().then(() => setLoadedKey(docKey))
      return
    }
    if (requestedKeyRef.current === docKey) return
    let canceled = false
    requestedKeyRef.current = docKey

    const fetchComments = window.api?.commentsGet
      ? window.api.commentsGet(docKey)
      : Promise.resolve({ success: true, threads: [] })

    fetchComments
      .then((res) => {
        if (canceled) return
        const nextThreads = Array.isArray(res?.threads) ? res.threads : []
        threadsRef.current = nextThreads
        setThreads(nextThreads)
        setActiveThreadId(null)
        setDraftAnchor(null)
        setAddingToThreadId(null)
        dirtyRef.current = false
        setLoadedKey(docKey)
      })
      .catch(() => {
        if (canceled) return
        threadsRef.current = []
        setThreads([])
        setLoadedKey(docKey)
      })
    return () => {
      canceled = true
    }
  }, [docKey])

  const moveComments = useCallback(
    async ({ fromKey, toKey, fileName, filePath: targetPath }) => {
      if (!fromKey || !toKey || fromKey === toKey) return
      pendingMoveRef.current = toKey
      if (dirtyRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        dirtyRef.current = false
        if (window.api?.commentsSave) {
          await window.api.commentsSave({
            docKey: fromKey,
            docName: fileName,
            filePath: null,
            threads: refreshThreadAnchors(threadsRef.current)
          })
        }
      }
      if (window.api?.commentsMove) {
        const res = await window.api.commentsMove({
          fromKey,
          toKey,
          docName: fileName,
          filePath: targetPath
        })
        if (res && !res.success && res.error) showToast?.(res.error, 'error')
      }
    },
    [refreshThreadAnchors, showToast]
  )

  const loaded = loadedKey === docKey
  const resolvedRanges = useMemo(() => {
    if (!loaded) return []
    if (!isSourceMode && editor && !editor.isDestroyed) {
      return resolveThreadsInDoc(editor.state.doc, threads)
    }
    const text = source ?? ''
    return threads.map((thread) => {
      const resolved = resolveAnchorInText(text, thread.anchor)
      return {
        threadId: thread.id,
        from: resolved.fromOffset,
        to: resolved.toOffset,
        fromOffset: resolved.fromOffset,
        toOffset: resolved.toOffset,
        orphaned: resolved.orphaned
      }
    })
  }, [editor, isSourceMode, loaded, source, threads])

  // Keep ProseMirror decorations synchronized with resolved ranges, draft highlight, and visibility.
  useEffect(() => {
    if (!editor || editor.isDestroyed || isSourceMode) return
    const ranges = [...resolvedRanges]
    if (draftAnchor && !draftAnchor.isSource) {
      ranges.push({
        threadId: '__draft__',
        from: draftAnchor.from,
        to: draftAnchor.to,
        orphaned: false
      })
    }
    syncCommentHighlights(editor, {
      ranges,
      activeThreadId: draftAnchor ? '__draft__' : activeThreadId,
      hoveredThreadId,
      visible
    })
  }, [activeThreadId, draftAnchor, editor, hoveredThreadId, isSourceMode, resolvedRanges, visible])

  const startCommentFromSelection = useCallback(() => {
    if (isSourceMode) {
      const textarea = sourceRef?.current
      const text = source ?? ''
      if (!textarea) return false
      let start = textarea.selectionStart ?? 0
      let end = textarea.selectionEnd ?? start
      if (start === end) {
        const word = findWordRangeAtOffset(text, start)
        if (!word) return false
        start = word.fromOffset
        end = word.toOffset
        textarea.setSelectionRange(start, end)
      }
      if (start >= end) return false
      const existing = resolvedRanges.find(
        (item) => !item.orphaned && item.fromOffset === start && item.toOffset === end
      )
      onSetVisible?.(true)
      if (existing) {
        setDraftAnchor(null)
        setActiveThreadId(existing.threadId)
        setAddingToThreadId(existing.threadId)
        return true
      }
      setAddingToThreadId(null)
      setDraftAnchor({
        isSource: true,
        from: start,
        to: end,
        anchor: createAnchorFromTextOffsets(text, start, end)
      })
      setActiveThreadId('__draft__')
      return true
    }

    if (!editor || editor.isDestroyed) return false
    const { selection, doc } = editor.state
    let { from, to } = selection
    const plain = extractPlainDocumentText(doc)
    if (from === to) {
      const offset = pmPosToFlatOffset(doc, from)
      const word = findWordRangeAtOffset(plain, offset)
      if (!word) return false
      from = flatOffsetToPmPos(doc, word.fromOffset)
      to = flatOffsetToPmPos(doc, word.toOffset)
      if (from >= to) return false
      editor.commands.setTextSelection({ from, to })
    }

    const anchor = createAnchorFromPmRange(doc, from, to)
    if (!anchor.quote.trim()) return false

    const currentMapped = getMappedCommentRanges(editor)
    const existing = currentMapped.find(
      (item) => !item.orphaned && item.from === from && item.to === to
    )
    onSetVisible?.(true)
    if (existing) {
      setDraftAnchor(null)
      setActiveThreadId(existing.threadId)
      setAddingToThreadId(existing.threadId)
      return true
    }

    setAddingToThreadId(null)
    setDraftAnchor({
      isSource: false,
      from,
      to,
      anchor
    })
    setActiveThreadId('__draft__')
    return true
  }, [editor, isSourceMode, onSetVisible, resolvedRanges, source, sourceRef])

  const cancelDraft = useCallback(() => {
    setDraftAnchor(null)
    setAddingToThreadId(null)
    setActiveThreadId((prev) => (prev === '__draft__' ? null : prev))
  }, [])

  const submitDraft = useCallback(
    (rawBody) => {
      const body = rawBody.trim()
      if (!body || !draftAnchor) return null
      const now = Date.now()
      const newThread = {
        id: makeId(),
        anchor: draftAnchor.anchor,
        comments: [
          {
            id: makeId(),
            body,
            createdAt: now,
            updatedAt: now
          }
        ],
        createdAt: now
      }
      const nextThreads = [...threadsRef.current, newThread]
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setDraftAnchor(null)
      setAddingToThreadId(null)
      setActiveThreadId(newThread.id)
      scheduleSave()
      return newThread
    },
    [draftAnchor, scheduleSave]
  )

  const addCommentToThread = useCallback(
    (threadId, rawBody) => {
      const body = rawBody.trim()
      if (!body) return false
      const now = Date.now()
      const newComment = {
        id: makeId(),
        body,
        createdAt: now,
        updatedAt: now
      }
      const nextThreads = threadsRef.current.map((thread) =>
        thread.id === threadId ? { ...thread, comments: [...thread.comments, newComment] } : thread
      )
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setAddingToThreadId(null)
      setActiveThreadId(threadId)
      scheduleSave()
      return true
    },
    [scheduleSave]
  )

  const updateComment = useCallback(
    (threadId, commentId, rawBody) => {
      const body = rawBody.trim()
      if (!body) return false
      const now = Date.now()
      const nextThreads = threadsRef.current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              comments: thread.comments.map((c) =>
                c.id === commentId ? { ...c, body, updatedAt: now } : c
              )
            }
          : thread
      )
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      scheduleSave()
      return true
    },
    [scheduleSave]
  )

  const deleteComment = useCallback(
    (threadId, commentId) => {
      let removedThread = false
      const nextThreads = threadsRef.current.flatMap((thread) => {
        if (thread.id !== threadId) return [thread]
        const remaining = thread.comments.filter((c) => c.id !== commentId)
        if (!remaining.length) {
          removedThread = true
          return []
        }
        return [{ ...thread, comments: remaining }]
      })
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      if (removedThread) {
        setActiveThreadId((prev) => (prev === threadId ? null : prev))
        setAddingToThreadId((prev) => (prev === threadId ? null : prev))
      }
      scheduleSave()
    },
    [scheduleSave]
  )

  const deleteThread = useCallback(
    (threadId) => {
      const nextThreads = threadsRef.current.filter((thread) => thread.id !== threadId)
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setActiveThreadId((prev) => (prev === threadId ? null : prev))
      setAddingToThreadId((prev) => (prev === threadId ? null : prev))
      scheduleSave()
    },
    [scheduleSave]
  )

  const markDirtyOnDocChange = useCallback(() => {
    if (threadsRef.current.length > 0) {
      scheduleSave()
    }
  }, [scheduleSave])

  const focusThreadInEditor = useCallback(
    (threadId) => {
      setActiveThreadId(threadId)
      if (isSourceMode) {
        const range = resolvedRanges.find((r) => r.threadId === threadId)
        if (range && !range.orphaned && sourceRef?.current) {
          sourceRef.current.focus({ preventScroll: true })
          sourceRef.current.setSelectionRange(range.from, range.to)
        }
        return
      }
      if (!editor || editor.isDestroyed) return
      const mapped = getMappedCommentRanges(editor)
      const range =
        mapped.find((r) => r.threadId === threadId) ||
        resolvedRanges.find((r) => r.threadId === threadId)
      if (range && !range.orphaned) {
        editor.chain().setTextSelection({ from: range.from, to: range.to }).scrollIntoView().run()
      }
    },
    [editor, isSourceMode, resolvedRanges, sourceRef]
  )

  return {
    threads,
    resolvedRanges,
    activeThreadId,
    setActiveThreadId,
    hoveredThreadId,
    setHoveredThreadId,
    draftAnchor,
    addingToThreadId,
    setAddingToThreadId,
    startCommentFromSelection,
    cancelDraft,
    submitDraft,
    addCommentToThread,
    updateComment,
    deleteComment,
    deleteThread,
    moveComments,
    flushComments: persistNow,
    markDirtyOnDocChange,
    focusThreadInEditor
  }
}
