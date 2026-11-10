import { Fragment, useCallback, useLayoutEffect, useRef } from 'react'
import { matchClassName, revealMatch } from '../lib/manuscriptSearch'

export default function SourceEditor({ content, search, onReveal, spellCheck, onChange }) {
  const { matches, activeIndex, sourceRef, isBarFocused } = search
  const overlayRef = useRef(null)
  const activeMatchRef = useRef(null)
  const hasMatches = matches.length > 0

  // A textarea cannot style individual ranges. Mirror its visible text behind it.
  const syncOverlay = useCallback(() => {
    const source = sourceRef.current
    const overlay = overlayRef.current
    if (!overlay || !source) return
    overlay.style.width = `${source.clientWidth}px`
    overlay.style.height = `${source.clientHeight}px`
    overlay.scrollTop = source.scrollTop
    overlay.scrollLeft = source.scrollLeft
  }, [sourceRef])

  useLayoutEffect(() => {
    if (!hasMatches || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(syncOverlay)
    observer.observe(sourceRef.current)
    return () => observer.disconnect()
  }, [hasMatches, sourceRef, syncOverlay])

  useLayoutEffect(() => {
    if (!hasMatches) return
    syncOverlay()
    const active = activeMatchRef.current
    if (active && isBarFocused()) {
      revealMatch(sourceRef.current, active)
      syncOverlay()
      onReveal(active)
    }
  }, [matches, activeIndex, hasMatches, isBarFocused, onReveal, sourceRef, syncOverlay])

  return (
    <div className="source-editor-wrap">
      {hasMatches && (
        <div
          className="source-search-overlay fountain-source-editor"
          aria-hidden="true"
          ref={overlayRef}
        >
          {matches.map(({ from, to }, index) => (
            <Fragment key={from}>
              {content.slice(matches[index - 1]?.to ?? 0, from)}
              <span
                className={matchClassName(index === activeIndex)}
                ref={index === activeIndex ? activeMatchRef : undefined}
              >
                {content.slice(from, to)}
              </span>
            </Fragment>
          ))}
          {content.slice(matches.at(-1).to)}
          {content.endsWith('\n') && '\u200b'}
        </div>
      )}
      <textarea
        ref={sourceRef}
        aria-label="Markdown"
        className="fountain-source-editor"
        value={content}
        spellCheck={spellCheck}
        onScroll={syncOverlay}
        onChange={onChange}
      />
    </div>
  )
}
