import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMappedCommentRanges, layoutCommentBubbles } from '../lib/documentComments'
import { PencilIcon, PlusIcon, TrashIcon } from './Icons'

function formatCommentTime(timestamp, labels, language) {
  const diffMs = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return labels.justNow
  if (minutes < 60) return labels.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return labels.hoursAgo(hours)
  return new Date(timestamp).toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR', {
    month: 'short',
    day: 'numeric'
  })
}

function CommentComposer({
  initialValue = '',
  placeholder,
  submitLabel,
  cancelLabel,
  autoFocus = true,
  onSubmit,
  onCancel
}) {
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])

  const handleSubmit = (event) => {
    event?.preventDefault()
    if (!value.trim()) return
    onSubmit(value)
    setValue('')
  }

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="comment-composer-input"
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="comment-composer-actions">
        <button type="button" className="comment-btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="submit" className="comment-btn-primary" disabled={!value.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function CommentBubblesLayer({
  visible,
  threads,
  resolvedRanges,
  draftAnchor,
  activeThreadId,
  addingToThreadId,
  onSelectThread,
  onHoverThread,
  onStartAddingToThread,
  onCancelAddingToThread,
  onSubmitDraft,
  onCancelDraft,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  editor,
  isSourceMode,
  source,
  sourceRef,
  stageRef,
  measureVersion,
  labels,
  language
}) {
  const [editing, setEditing] = useState(null) // { threadId, commentId }
  const [heights, setHeights] = useState({})
  const [targets, setTargets] = useState({})
  const cardRefs = useRef(new Map())
  const observersRef = useRef(new Map())

  const rangeById = useMemo(() => {
    const map = new Map()
    for (const r of resolvedRanges) map.set(r.threadId, r)
    return map
  }, [resolvedRanges])

  const measureTargets = useCallback(() => {
    const stage = stageRef?.current
    if (!stage || !visible) return
    const stageRect = stage.getBoundingClientRect()
    const nextTargets = {}

    const measurePmPos = (pos, fallbackOffset = 0) => {
      if (isSourceMode) {
        const textarea = sourceRef?.current
        if (!textarea) return 0
        const taRect = textarea.getBoundingClientRect()
        const textLen = Math.max(1, (source || '').length)
        const ratio = Math.max(0, Math.min(1, fallbackOffset / textLen))
        return Math.max(
          0,
          taRect.top - stageRect.top + ratio * Math.max(80, textarea.scrollHeight - 40)
        )
      }
      if (!editor || editor.isDestroyed) return 0
      try {
        const clamped = Math.max(0, Math.min(pos, editor.state.doc.content.size))
        const coords = editor.view.coordsAtPos(clamped)
        return Math.max(0, coords.top - stageRect.top - 10)
      } catch {
        return 0
      }
    }

    const mappedById =
      !isSourceMode && editor && !editor.isDestroyed
        ? new Map(getMappedCommentRanges(editor).map((r) => [r.threadId, r]))
        : null

    for (const thread of threads) {
      const range = mappedById?.get(thread.id) || rangeById.get(thread.id)
      if (!range) {
        nextTargets[thread.id] = 0
      } else {
        nextTargets[thread.id] = measurePmPos(
          range.from,
          range.fromOffset ?? thread.anchor?.fromOffset ?? 0
        )
      }
    }

    if (draftAnchor) {
      nextTargets.__draft__ = measurePmPos(
        draftAnchor.from,
        draftAnchor.anchor?.fromOffset ?? draftAnchor.from ?? 0
      )
    }

    setTargets(nextTargets)
  }, [draftAnchor, editor, isSourceMode, rangeById, source, sourceRef, stageRef, threads, visible])

  useEffect(() => {
    if (!visible) return
    const frame = requestAnimationFrame(measureTargets)
    const stage = stageRef?.current
    if (!stage || typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame)
    }
    const observer = new ResizeObserver(() => requestAnimationFrame(measureTargets))
    observer.observe(stage)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measureTargets, measureVersion, stageRef, visible])

  const registerCardRef = useCallback((id, node) => {
    const prevObserver = observersRef.current.get(id)
    if (prevObserver) {
      prevObserver.disconnect()
      observersRef.current.delete(id)
    }
    if (!node) {
      cardRefs.current.delete(id)
      return
    }
    cardRefs.current.set(id, node)
    const updateHeight = () => {
      const h = node.offsetHeight || 96
      setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }))
    }
    requestAnimationFrame(updateHeight)
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeight)
      ro.observe(node)
      observersRef.current.set(id, ro)
    }
  }, [])

  useEffect(() => {
    const observers = observersRef.current
    return () => {
      for (const ro of observers.values()) ro.disconnect()
      observers.clear()
    }
  }, [])

  const visibleThreads = useMemo(
    () => threads.filter((thread) => !rangeById.get(thread.id)?.orphaned),
    [rangeById, threads]
  )

  const items = useMemo(() => {
    const list = visibleThreads.map((thread) => ({
      id: thread.id,
      targetY: targets[thread.id] ?? 0,
      height: heights[thread.id] ?? 96
    }))
    if (draftAnchor) {
      list.push({
        id: '__draft__',
        targetY: targets.__draft__ ?? 0,
        height: heights.__draft__ ?? 132
      })
    }
    return list
  }, [draftAnchor, heights, targets, visibleThreads])

  const layout = useMemo(
    () =>
      layoutCommentBubbles(items, {
        gap: 12,
        activeId: draftAnchor ? '__draft__' : activeThreadId
      }),
    [activeThreadId, draftAnchor, items]
  )

  if (!visible || (!visibleThreads.length && !draftAnchor)) return null

  return (
    <aside
      className={`comments-margin-rail ${activeThreadId || draftAnchor ? 'has-active-comment' : ''}`}
      aria-label={labels.panelTitle}
      style={{ minHeight: layout.totalHeight ? `${layout.totalHeight + 24}px` : undefined }}
    >
      {visibleThreads.map((thread) => {
        const isActive = activeThreadId === thread.id
        const top = layout.positions.get(thread.id) ?? 0
        const targetY = targets[thread.id] ?? top
        const stemOffset = Math.max(-18, Math.min(28, targetY - top + 18))

        return (
          <article
            key={thread.id}
            ref={(node) => registerCardRef(thread.id, node)}
            className={`comment-bubble ${isActive ? 'is-active' : ''}`}
            style={{ top: `${top}px` }}
            onMouseEnter={() => onHoverThread?.(thread.id)}
            onMouseLeave={() => onHoverThread?.(null)}
            onClick={() => onSelectThread?.(thread.id)}
          >
            <span
              className="comment-bubble-stem"
              aria-hidden="true"
              style={{ top: `${Math.max(10, stemOffset)}px` }}
            />

            <div className="comment-items-list">
              {thread.comments.map((comment) => {
                const isEditingThis =
                  editing?.threadId === thread.id && editing?.commentId === comment.id
                return (
                  <div key={comment.id} className="comment-entry">
                    <div className="comment-entry-header">
                      <time className="comment-entry-time">
                        {formatCommentTime(comment.createdAt, labels, language)}
                      </time>
                      {!isEditingThis && (
                        <div className="comment-entry-actions">
                          <button
                            type="button"
                            className="comment-entry-action-btn"
                            title={labels.edit}
                            aria-label={labels.edit}
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditing({ threadId: thread.id, commentId: comment.id })
                            }}
                          >
                            <PencilIcon size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="comment-entry-action-btn is-danger"
                            title={labels.delete}
                            aria-label={labels.delete}
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteComment(thread.id, comment.id)
                            }}
                          >
                            <TrashIcon size={12} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingThis ? (
                      <CommentComposer
                        initialValue={comment.body}
                        placeholder={labels.placeholder}
                        submitLabel={labels.saveEdit}
                        cancelLabel={labels.cancel}
                        onSubmit={(nextBody) => {
                          onUpdateComment(thread.id, comment.id, nextBody)
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <p className="comment-entry-body">{comment.body}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {addingToThreadId === thread.id ? (
              <div className="comment-add-form-wrap" onClick={(event) => event.stopPropagation()}>
                <CommentComposer
                  placeholder={labels.placeholder}
                  submitLabel={labels.save}
                  cancelLabel={labels.cancel}
                  onSubmit={(body) => onAddComment(thread.id, body)}
                  onCancel={onCancelAddingToThread}
                />
              </div>
            ) : isActive ? (
              <button
                type="button"
                className="comment-add-another-btn"
                onClick={(event) => {
                  event.stopPropagation()
                  onStartAddingToThread(thread.id)
                }}
              >
                <PlusIcon size={12} aria-hidden="true" />
                <span>{labels.addAnother}</span>
              </button>
            ) : null}
          </article>
        )
      })}

      {draftAnchor && (
        <article
          ref={(node) => registerCardRef('__draft__', node)}
          className="comment-bubble is-active is-draft"
          style={{ top: `${layout.positions.get('__draft__') ?? 0}px` }}
        >
          <span className="comment-bubble-stem" aria-hidden="true" style={{ top: '18px' }} />
          <div className="comment-draft-quote">“{draftAnchor.anchor.quote}”</div>
          <CommentComposer
            placeholder={labels.placeholder}
            submitLabel={labels.save}
            cancelLabel={labels.cancel}
            onSubmit={onSubmitDraft}
            onCancel={onCancelDraft}
          />
        </article>
      )}
    </aside>
  )
}
