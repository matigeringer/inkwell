import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAnchorFromPmRange,
  createAnchorFromTextOffsets,
  extractPlainDocumentText,
  findWordRangeAtOffset,
  flatOffsetToPmPos,
  getMappedCommentRanges,
  mapThreadsAcrossTextChange,
  pmPosToFlatOffset,
  resolveAnchorInText,
  resolveThreadsInDoc,
  syncCommentHighlights
} from '../lib/documentComments'

function anchorsEqual(a, b) {
  return (
    a?.quote === b?.quote &&
    a?.prefix === b?.prefix &&
    a?.suffix === b?.suffix &&
    a?.fromOffset === b?.fromOffset &&
    a?.toOffset === b?.toOffset
  )
}

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
  const pendingMoveRef = useRef(null)
  const autoDeletedThreadsRef = useRef([])
  const pendingReconcileRef = useRef(false)
  const prevSourceRef = useRef(source)
  const latestDocStateRef = useRef({ editor, isSourceMode, source })
  useEffect(() => {
    latestDocStateRef.current = { editor, isSourceMode, source }
  }, [editor, isSourceMode, source])

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
    const anchorsChanged =
      updatedThreads.length !== threadsRef.current.length ||
      updatedThreads.some((t, idx) => !anchorsEqual(t.anchor, threadsRef.current[idx]?.anchor))
    threadsRef.current = updatedThreads
    if (anchorsChanged) {
      setThreads(updatedThreads)
    }
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

  const reconcileLoadedThreads = useCallback((list) => {
    if (!list.length) return { threads: list, changed: false }
    const { editor: ed, isSourceMode: srcMode, source: srcText } = latestDocStateRef.current

    if (!srcMode) {
      if (!ed || ed.isDestroyed) return null
      const resolvedList = resolveThreadsInDoc(ed.state.doc, list)
      let changed = false
      const surviving = []
      for (let i = 0; i < list.length; i++) {
        const thread = list[i]
        const resolved = resolvedList[i]
        if (!resolved || resolved.orphaned) {
          changed = true
          continue
        }
        const nextAnchor = createAnchorFromPmRange(ed.state.doc, resolved.from, resolved.to)
        if (!anchorsEqual(thread.anchor, nextAnchor)) {
          changed = true
          surviving.push({ ...thread, anchor: nextAnchor })
        } else {
          surviving.push(thread)
        }
      }
      return { threads: surviving, changed }
    }

    const text = srcText ?? ''
    let changed = false
    const surviving = []
    for (const thread of list) {
      const resolved = resolveAnchorInText(text, thread.anchor)
      if (resolved.orphaned) {
        changed = true
        continue
      }
      const nextAnchor = createAnchorFromTextOffsets(text, resolved.fromOffset, resolved.toOffset)
      if (!anchorsEqual(thread.anchor, nextAnchor)) {
        changed = true
        surviving.push({ ...thread, anchor: nextAnchor })
      } else {
        surviving.push(thread)
      }
    }
    return { threads: surviving, changed }
  }, [])

  // Load comments when docKey changes unless we just moved the active key in-place.
  useEffect(() => {
    if (!docKey) return
    if (pendingMoveRef.current === docKey) {
      pendingMoveRef.current = null
      return
    }
    let canceled = false
    autoDeletedThreadsRef.current = []
    prevSourceRef.current = latestDocStateRef.current.source

    const fetchComments = window.api?.commentsGet
      ? window.api.commentsGet(docKey)
      : Promise.resolve({ success: true, threads: [] })

    fetchComments
      .then((res) => {
        if (canceled) return
        const nextThreads = Array.isArray(res?.threads) ? res.threads : []
        const reconciled = reconcileLoadedThreads(nextThreads)
        setActiveThreadId(null)
        setDraftAnchor(null)
        setAddingToThreadId(null)
        if (!reconciled) {
          threadsRef.current = nextThreads
          setThreads(nextThreads)
          pendingReconcileRef.current = true
          dirtyRef.current = false
          return
        }
        pendingReconcileRef.current = false
        threadsRef.current = reconciled.threads
        setThreads(reconciled.threads)
        if (reconciled.changed) {
          scheduleSave()
        } else {
          dirtyRef.current = false
        }
      })
      .catch(() => {
        if (canceled) return
        pendingReconcileRef.current = false
        threadsRef.current = []
        setThreads([])
      })
    return () => {
      canceled = true
    }
  }, [docKey, reconcileLoadedThreads, scheduleSave])

  useEffect(() => {
    if (!pendingReconcileRef.current) return
    const reconciled = reconcileLoadedThreads(threadsRef.current)
    if (!reconciled) return
    pendingReconcileRef.current = false
    if (reconciled.changed) {
      threadsRef.current = reconciled.threads
      setThreads(reconciled.threads)
      scheduleSave()
    }
  }, [editor, isSourceMode, reconcileLoadedThreads, scheduleSave, source])

  useEffect(() => {
    if (!isSourceMode) {
      prevSourceRef.current = source
      return
    }
    const prev = prevSourceRef.current
    prevSourceRef.current = source
    if (prev == null || source == null || prev === source || !threadsRef.current.length) return

    const { threads: surviving, deleted } = mapThreadsAcrossTextChange(
      threadsRef.current,
      prev,
      source
    )
    if (deleted.length) {
      const deletedIds = new Set(deleted.map((t) => t.id))
      setActiveThreadId((curr) => (deletedIds.has(curr) ? null : curr))
      setAddingToThreadId((curr) => (deletedIds.has(curr) ? null : curr))
      setHoveredThreadId((curr) => (deletedIds.has(curr) ? null : curr))
    }
    threadsRef.current = surviving
    setThreads(surviving)
    scheduleSave()
  }, [isSourceMode, scheduleSave, source])

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

  const resolvedRanges = useMemo(() => {
    if (!threads.length) return []
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
  }, [editor, isSourceMode, source, threads])

  // Sync resolved ranges when threads or draftAnchor change, preserving live mapped positions per thread.
  useEffect(() => {
    if (!editor || editor.isDestroyed || isSourceMode) return
    const mappedById = new Map(
      getMappedCommentRanges(editor)
        .filter((r) => r.threadId !== '__draft__' && !r.orphaned)
        .map((r) => [r.threadId, r])
    )
    const baseRanges = resolvedRanges.map(
      (resolved) => mappedById.get(resolved.threadId) || resolved
    )
    const ranges = [...baseRanges]
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
      const nextThreads = [...refreshThreadAnchors(threadsRef.current), newThread]
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setDraftAnchor(null)
      setAddingToThreadId(null)
      setActiveThreadId(newThread.id)
      scheduleSave()
      return newThread
    },
    [draftAnchor, refreshThreadAnchors, scheduleSave]
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
      const nextThreads = refreshThreadAnchors(threadsRef.current).map((thread) =>
        thread.id === threadId ? { ...thread, comments: [...thread.comments, newComment] } : thread
      )
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setAddingToThreadId(null)
      setActiveThreadId(threadId)
      scheduleSave()
      return true
    },
    [refreshThreadAnchors, scheduleSave]
  )

  const updateComment = useCallback(
    (threadId, commentId, rawBody) => {
      const body = rawBody.trim()
      if (!body) return false
      const now = Date.now()
      const nextThreads = refreshThreadAnchors(threadsRef.current).map((thread) =>
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
    [refreshThreadAnchors, scheduleSave]
  )

  const deleteComment = useCallback(
    (threadId, commentId) => {
      let removedThread = false
      const nextThreads = refreshThreadAnchors(threadsRef.current).flatMap((thread) => {
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
    [refreshThreadAnchors, scheduleSave]
  )

  const deleteThread = useCallback(
    (threadId) => {
      const nextThreads = refreshThreadAnchors(threadsRef.current).filter(
        (thread) => thread.id !== threadId
      )
      threadsRef.current = nextThreads
      setThreads(nextThreads)
      setActiveThreadId((prev) => (prev === threadId ? null : prev))
      setAddingToThreadId((prev) => (prev === threadId ? null : prev))
      scheduleSave()
    },
    [refreshThreadAnchors, scheduleSave]
  )

  const markDirtyOnDocChange = useCallback(
    (transaction) => {
      if (isSourceMode || !editor || editor.isDestroyed) {
        if (threadsRef.current.length > 0) scheduleSave()
        return
      }

      const mapped = getMappedCommentRanges(editor)
      const mappedDraft = mapped.find((r) => r.threadId === '__draft__')
      if (mappedDraft?.orphaned) {
        cancelDraft()
      }

      const mappedById = new Map(
        mapped.filter((r) => r.threadId !== '__draft__').map((r) => [r.threadId, r])
      )

      const historyMeta = transaction?.getMeta?.('history$')
      const isUndo = Boolean(historyMeta && !historyMeta.redo)
      const restored = []

      if (isUndo && autoDeletedThreadsRef.current.length > 0) {
        const plain = extractPlainDocumentText(editor.state.doc)
        const existingIds = new Set(threadsRef.current.map((t) => t.id))
        const remainingDeleted = []
        for (const entry of autoDeletedThreadsRef.current) {
          if (existingIds.has(entry.id)) continue
          const resolved = resolveAnchorInText(plain, entry.anchor)
          if (!resolved.orphaned && !resolved.reanchored) {
            const from = flatOffsetToPmPos(editor.state.doc, resolved.fromOffset)
            const to = flatOffsetToPmPos(editor.state.doc, resolved.toOffset)
            if (from < to) {
              restored.push({
                ...entry,
                anchor: createAnchorFromPmRange(editor.state.doc, from, to)
              })
              continue
            }
          }
          remainingDeleted.push(entry)
        }
        autoDeletedThreadsRef.current = remainingDeleted
      }

      const surviving = []
      const newlyDeleted = []
      for (const thread of threadsRef.current) {
        const range = mappedById.get(thread.id)
        if (range?.orphaned) {
          newlyDeleted.push({
            ...thread,
            anchor: range.deletedAnchor || thread.anchor
          })
        } else {
          surviving.push(thread)
        }
      }

      if (newlyDeleted.length > 0) {
        autoDeletedThreadsRef.current = [...autoDeletedThreadsRef.current, ...newlyDeleted].slice(
          -50
        )
        const deletedIds = new Set(newlyDeleted.map((t) => t.id))
        setActiveThreadId((curr) => (deletedIds.has(curr) ? null : curr))
        setAddingToThreadId((curr) => (deletedIds.has(curr) ? null : curr))
        setHoveredThreadId((curr) => (deletedIds.has(curr) ? null : curr))
      }

      if (newlyDeleted.length > 0 || restored.length > 0) {
        const refreshedSurviving = surviving.map((thread) => {
          const range = mappedById.get(thread.id)
          if (!range || range.orphaned) return thread
          return {
            ...thread,
            anchor: createAnchorFromPmRange(editor.state.doc, range.from, range.to)
          }
        })
        const nextThreads = [...refreshedSurviving, ...restored]
        threadsRef.current = nextThreads
        setThreads(nextThreads)
        scheduleSave()
        return
      }

      if (threadsRef.current.length > 0) {
        scheduleSave()
      }
    },
    [cancelDraft, editor, isSourceMode, scheduleSave]
  )

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
        editor.chain().setTextSelection(range.from).scrollIntoView().run()
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
