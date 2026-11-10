import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorState } from '@tiptap/react'
import { findManuscriptMatches, highlightManuscriptMatches } from '../lib/manuscriptSearch'

export default function useManuscriptSearch({ editor, source, onReveal }) {
  const [search, setSearch] = useState(null)
  const isOpen = search !== null
  const query = search?.query ?? ''
  const inputRef = useRef(null)
  const barRef = useRef(null)
  const sourceRef = useRef(null)
  const doc = useEditorState({
    editor,
    selector: ({ editor }) => (source === null && query ? editor?.state.doc : null),
    equalityFn: Object.is
  })
  const matches = useMemo(
    () => findManuscriptMatches(query, source ?? '', doc),
    [query, source, doc]
  )
  const activeIndex = Math.min(search?.index ?? 0, matches.length - 1)

  const open = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    } else {
      setSearch({ query: '', index: 0 })
    }
  }, [])

  const close = useCallback(() => {
    setSearch(null)
    const surface = sourceRef.current ?? editor?.view.dom
    surface?.focus({ preventScroll: true })
  }, [editor])

  useLayoutEffect(() => {
    if (isOpen) inputRef.current.focus()
  }, [isOpen])

  const isBarFocused = useCallback(() => barRef.current?.contains(document.activeElement), [])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    highlightManuscriptMatches(editor, source === null ? matches : [], activeIndex)
    if (source !== null || !matches.length || !isBarFocused()) return
    const active = editor.view.dom.querySelector('.is-current-match')
    if (active) onReveal(active)
  }, [editor, source, matches, activeIndex, isBarFocused, onReveal])

  return {
    isOpen,
    query,
    matches,
    activeIndex,
    inputRef,
    barRef,
    sourceRef,
    isBarFocused,
    open,
    close,
    changeQuery: (query) => setSearch({ query, index: 0 }),
    navigate: (direction) => {
      const count = matches.length
      if (count) setSearch({ query, index: (activeIndex + direction + count) % count })
    }
  }
}
