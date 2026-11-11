import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import useDocumentOutline from '../hooks/useDocumentOutline'
import { revealMatch } from '../lib/manuscriptSearch'
import { CloseIcon, SearchIcon } from './Icons'

const searchText = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export default function DocumentOutline({
  open,
  searchOnly = false,
  onClose,
  labels,
  scrollRef,
  sourceRef,
  onManualScroll,
  ...options
}) {
  const { headings, activeIndex, jumpTo } = useDocumentOutline({ ...options, scrollRef, sourceRef })
  const hasHeadings = headings.length > 0
  const [query, setQuery] = useState('')
  const navRef = useRef(null)
  const filterRef = useRef(null)
  const listRef = useRef(null)
  const currentRef = useRef(null)
  const searchTerms = useMemo(() => searchText(query).match(/\S+/g), [query])
  const entries = useMemo(() => {
    const terms = open ? searchTerms : null
    if (searchOnly && !terms) return []
    return headings.flatMap((heading, index) => {
      if (terms) {
        const title = searchText(heading.title)
        if (!terms.every((term) => title.includes(term))) return []
      }
      return [{ ...heading, index }]
    })
  }, [headings, open, searchOnly, searchTerms])

  useLayoutEffect(() => {
    if (open) filterRef.current?.focus()
  }, [open])

  useLayoutEffect(() => {
    const list = listRef.current
    const current = currentRef.current
    if (!list || !current) return
    if (open) {
      if (!list.contains(document.activeElement)) revealMatch(list, current)
    } else if (list.scrollHeight > list.clientHeight) {
      const item = current.getBoundingClientRect()
      const bounds = list.getBoundingClientRect()
      list.scrollTop += item.top - bounds.top + (item.height - list.clientHeight) / 2
    }
  }, [activeIndex, headings, open, query])

  useLayoutEffect(() => {
    const nav = navRef.current
    if (open || !nav || !hasHeadings) return

    const handleWheel = (event) => {
      const { deltaMode, deltaX, deltaY } = event
      if (
        !event.cancelable ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(deltaX) >= Math.abs(deltaY)
      ) {
        return
      }

      const container = scrollRef.current
      if (!container) return
      event.preventDefault()
      onManualScroll()

      let distance = deltaY
      if (deltaMode === event.DOM_DELTA_LINE) distance *= 16
      if (deltaMode === event.DOM_DELTA_PAGE) distance *= container.clientHeight

      const textarea = sourceRef.current
      if (textarea) {
        const bounds = container.getBoundingClientRect()
        const sourceBounds = textarea.getBoundingClientRect()
        if (sourceBounds.bottom > bounds.top && sourceBounds.top < bounds.bottom) {
          const start = textarea.scrollTop
          textarea.scrollTop += distance
          distance -= textarea.scrollTop - start
        }
      }
      container.scrollTop += distance
    }

    // Forward the wheel to the document and let the active heading drive the rail.
    nav.addEventListener('wheel', handleWheel, { passive: false })
    return () => nav.removeEventListener('wheel', handleWheel)
  }, [hasHeadings, onManualScroll, open, scrollRef, sourceRef])

  if (!open && !hasHeadings) return null

  const navigate = (index) => {
    if (searchOnly || (open && getComputedStyle(navRef.current).position === 'absolute')) onClose()
    jumpTo(index)
  }

  const Landmark = searchOnly ? 'div' : 'nav'
  return (
    <div className={searchOnly ? 'zen-outline-search' : 'document-outline-slot'}>
      <Landmark
        id={searchOnly ? 'zen-outline-search' : 'document-outline'}
        ref={navRef}
        className={`document-outline ${open ? 'is-expanded' : 'is-compact'}${searchOnly ? ' is-search-only' : ''}`}
        role={searchOnly ? 'search' : undefined}
        aria-label={searchOnly ? labels.search : labels.title}
        onKeyDown={(event) => {
          if (open && !searchOnly && event.key === 'Escape' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
      >
        {open && (
          <>
            <div className="document-outline-header">
              <h2>{searchOnly ? labels.search : labels.title}</h2>
              <button
                type="button"
                className="btn-icon-sober"
                onClick={onClose}
                aria-label={searchOnly ? labels.closeSearch : labels.close}
              >
                <CloseIcon size={15} aria-hidden="true" />
              </button>
            </div>
            <form
              className="document-outline-filter"
              onSubmit={(event) => {
                event.preventDefault()
                if (entries.length) navigate(entries[0].index)
              }}
            >
              <SearchIcon size={14} aria-hidden="true" />
              <input
                ref={filterRef}
                type="search"
                aria-label={labels.filter}
                placeholder={labels.filter}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
          </>
        )}
        {entries.length ? (
          <ul className="document-outline-list" ref={listRef}>
            {entries.map(({ from, title, depth, level, index }) => (
              <li key={from} style={{ '--outline-depth': depth, '--outline-level': level }}>
                <button
                  type="button"
                  className="document-outline-heading"
                  title={title}
                  aria-label={open ? undefined : title}
                  aria-current={index === activeIndex ? 'location' : undefined}
                  ref={index === activeIndex ? currentRef : undefined}
                  onClick={() => navigate(index)}
                >
                  <span className="document-outline-mark" aria-hidden="true" />
                  {open && <span className="document-outline-label">{title}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          (!searchOnly || !hasHeadings || searchTerms) && (
            <p className="document-outline-empty" role="status">
              {headings.length ? labels.noResults : labels.empty}
            </p>
          )
        )}
      </Landmark>
    </div>
  )
}
