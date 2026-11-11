import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorState } from '@tiptap/react'
import { sourceHeadings } from '../lib/markdownSupport'

function richTextHeadings(doc) {
  const headings = []
  doc?.descendants((node, from) => {
    if (node.type.name !== 'heading') return
    headings.push({
      from,
      level: node.attrs.level,
      title: node.textBetween(0, node.content.size, ' ', ' ')
    })
    return false
  })
  return headings
}

function headingDepths(headings) {
  const ancestors = []
  return headings.flatMap((heading) => {
    const title = heading.title.replace(/\s+/g, ' ').trim()
    if (!title) return []
    while (ancestors.length && ancestors.at(-1) >= heading.level) ancestors.pop()
    const depth = ancestors.length
    ancestors.push(heading.level)
    return [{ ...heading, title, depth }]
  })
}

function measureSourceHeadings(textarea, headings) {
  // Measure wrapped lines with the same typography and width as the textarea.
  const mirror = document.createElement('div')
  mirror.className = 'source-search-overlay fountain-source-editor'
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.height = `${textarea.clientHeight}px`
  mirror.style.visibility = 'hidden'
  const text = document.createTextNode(textarea.value)
  mirror.append(text)
  textarea.before(mirror)
  try {
    const origin = mirror.getBoundingClientRect().top
    const range = document.createRange()
    return headings.map(({ from }) => {
      range.setStart(text, from)
      range.setEnd(text, from + 1)
      return range.getBoundingClientRect().top - origin
    })
  } finally {
    mirror.remove()
  }
}

const JUMP_INSET = 18

export default function useDocumentOutline({ editor, source, sourceRef, scrollRef, onJump }) {
  const doc = useEditorState({
    editor,
    selector: ({ editor }) => (source === null ? editor?.state.doc : null),
    equalityFn: Object.is
  })
  const headings = useMemo(
    () => headingDepths(source === null ? richTextHeadings(doc) : sourceHeadings(source)),
    [doc, source]
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const jumpRef = useRef(null)

  useLayoutEffect(() => {
    const container = scrollRef.current
    const textarea = sourceRef.current
    const view = source === null && !editor?.isDestroyed ? editor?.view : null
    const surface = textarea ?? view?.dom
    if (!container || !surface || !headings.length) return

    let frame = null
    let sourceOffsets = null
    let lastJump = null

    const isCurrent = () => (textarea ? textarea.value === source : view.state.doc === doc)
    const headingTop = (index) => {
      if (textarea) {
        sourceOffsets ??= measureSourceHeadings(textarea, headings)
        return sourceOffsets[index]
      }
      return (
        view.nodeDOM(headings[index].from).getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop
      )
    }

    const update = () => {
      frame = null
      if (!isCurrent()) return
      if (
        lastJump &&
        lastJump.scrollTop === container.scrollTop &&
        lastJump.sourceScrollTop === textarea?.scrollTop
      ) {
        return
      }
      lastJump = null
      const bounds = container.getBoundingClientRect()
      let readingLine = container.scrollTop + Math.min(72, container.clientHeight / 4)
      if (textarea) {
        const sourceBounds = textarea.getBoundingClientRect()
        const visibleTop = Math.max(bounds.top, sourceBounds.top)
        const visibleHeight = Math.max(0, Math.min(bounds.bottom, sourceBounds.bottom) - visibleTop)
        readingLine =
          visibleTop - sourceBounds.top + textarea.scrollTop + Math.min(72, visibleHeight / 4)
      }
      let start = 0
      let end = headings.length
      while (start < end) {
        const middle = Math.floor((start + end) / 2)
        if (headingTop(middle) <= readingLine) start = middle + 1
        else end = middle
      }
      setActiveIndex(Math.max(0, start - 1))
    }

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    const invalidate = () => {
      sourceOffsets = null
      schedule()
    }

    jumpRef.current = (index) => {
      if (!isCurrent()) return
      onJump()
      const top = headingTop(index)
      if (textarea) {
        textarea.scrollTop = top - JUMP_INSET
        container.scrollTop +=
          textarea.getBoundingClientRect().top +
          top -
          textarea.scrollTop -
          container.getBoundingClientRect().top -
          JUMP_INSET
      } else {
        container.scrollTop = top - JUMP_INSET
      }
      // The last headings may be visible even when there is no room to align them at the top.
      lastJump = { scrollTop: container.scrollTop, sourceScrollTop: textarea?.scrollTop }
      setActiveIndex(index)
    }

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate)
    resizeObserver?.observe(container)
    resizeObserver?.observe(surface)
    container.addEventListener('scroll', schedule)
    textarea?.addEventListener('scroll', schedule)
    document.fonts?.addEventListener('loadingdone', invalidate)
    schedule()
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      container.removeEventListener('scroll', schedule)
      textarea?.removeEventListener('scroll', schedule)
      document.fonts?.removeEventListener('loadingdone', invalidate)
      jumpRef.current = null
    }
  }, [doc, editor, headings, onJump, scrollRef, source, sourceRef])

  const jumpTo = useCallback((index) => jumpRef.current?.(index), [])
  return { headings, activeIndex: Math.min(activeIndex, headings.length - 1), jumpTo }
}
