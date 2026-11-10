import { Fragment, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { matchClassName, revealMatch, syncSourceOverlay } from '../lib/manuscriptSearch'

function sourceHighlights(matches, activeIndex, workspaceMatch) {
  const highlights = matches.map((range, index) => ({ ...range, active: index === activeIndex }))
  if (!workspaceMatch) return highlights

  const { from, to } = workspaceMatch
  const activeStart = matches[activeIndex]?.from
  // The overlay mirrors the document once. Split other highlights at the workspace match.
  return [
    ...highlights
      .filter((range) => range.from < from)
      .map((range) => ({ ...range, to: Math.min(range.to, from) })),
    { from, to, workspace: true, active: activeStart >= from && activeStart < to },
    ...highlights
      .filter((range) => range.to > to)
      .map((range) => ({
        from: Math.max(range.from, to),
        to: range.to,
        active: range.active && range.from >= to
      }))
  ]
}

export default function SourceEditor({
  content,
  search,
  workspaceMatch,
  onReveal,
  spellCheck,
  onChange
}) {
  const { matches, activeIndex, sourceRef, isBarFocused } = search
  const overlayRef = useRef(null)
  const activeMatchRef = useRef(null)
  const highlights = useMemo(
    () => sourceHighlights(matches, activeIndex, workspaceMatch),
    [matches, activeIndex, workspaceMatch]
  )
  const hasMatches = highlights.length > 0

  // A textarea cannot style individual ranges. Mirror its visible text behind it.
  const syncOverlay = useCallback(() => {
    const source = sourceRef.current
    const overlay = overlayRef.current
    if (!overlay || !source) return
    syncSourceOverlay(source, overlay)
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
  }, [highlights, hasMatches, isBarFocused, onReveal, sourceRef, syncOverlay])

  return (
    <div className="source-editor-wrap">
      {hasMatches && (
        <div
          className="source-search-overlay fountain-source-editor"
          aria-hidden="true"
          ref={overlayRef}
        >
          {highlights.map(({ from, to, active, workspace }, index) => (
            <Fragment key={from}>
              {content.slice(highlights[index - 1]?.to ?? 0, from)}
              <span
                className={workspace ? 'workspace-editor-match' : matchClassName(active)}
                ref={active ? activeMatchRef : undefined}
              >
                {content.slice(from, to)}
              </span>
            </Fragment>
          ))}
          {content.slice(highlights.at(-1).to)}
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
