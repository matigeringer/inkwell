import { useLayoutEffect, useRef } from 'react'
import { ChevronDownIcon, CloseIcon, FileTextIcon, SearchIcon } from './Icons'
import { matchClassName } from '../lib/manuscriptSearch'

export default function WorkspaceSearch({
  search,
  labels,
  navigationLabels,
  getActiveFile,
  onOpen,
  onClose = search.close
}) {
  const input = useRef(null)
  const activeResult = useRef(null)
  const { query, scope, changeQuery, submit, result, focusRequest } = search
  const folder = scope.path.split(/[\\/]/).filter(Boolean).at(-1) || scope.path
  const matches =
    result?.groups.flatMap((group) => group.matches.map((match) => ({ group, match }))) ?? []
  const selected = result?.selected
  const activeIndex = selected
    ? matches.findIndex(
        ({ group, match }) =>
          group.path === selected.path &&
          match.block === selected.block &&
          match.offset === selected.offset
      )
    : -1
  const activeMatch = matches[activeIndex]?.match
  const count = matches.length
  const canNavigate = count > 1 || (count === 1 && activeIndex < 0)

  const navigate = (direction) => {
    const start = activeIndex < 0 && direction < 0 ? 0 : activeIndex
    const { group, match } = matches[(start + direction + count) % count]
    onOpen(group, match)
  }

  useLayoutEffect(() => {
    input.current.focus()
    input.current.select()
  }, [focusRequest])

  useLayoutEffect(() => {
    activeResult.current?.scrollIntoView?.({ block: 'nearest' })
  }, [activeMatch])

  const status =
    result?.status === 'running'
      ? labels.progress
      : result?.status === 'error'
        ? labels.error
        : result?.status === 'canceled'
          ? labels.canceled
          : result?.status === 'done' && !result.groups.length && !result.limited && !result.skipped
            ? labels.noResults
            : ''

  return (
    <section
      id="workspace-search"
      className="workspace-search"
      role="search"
      aria-label={labels.title}
    >
      <form
        className="workspace-search-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit(getActiveFile)
        }}
      >
        <div className="workspace-search-field">
          <SearchIcon size={14} aria-hidden="true" />
          <input
            ref={input}
            type="search"
            value={query}
            maxLength={512}
            autoComplete="off"
            spellCheck={false}
            aria-label={labels.title}
            placeholder={labels.placeholder}
            onChange={(event) => changeQuery(event.target.value, getActiveFile)}
          />
        </div>
        <button
          type="button"
          className="btn-icon-sober"
          title={labels.close}
          aria-label={labels.close}
          onClick={() => onClose()}
        >
          <CloseIcon size={15} aria-hidden="true" />
        </button>
      </form>
      <div className="workspace-search-meta">
        <p className="workspace-search-folder" title={scope.path}>
          {folder}
        </p>
        {count > 0 && (
          <>
            <span className="workspace-search-count" role="status">
              {navigationLabels.count(activeIndex + 1, count)}
            </span>
            <div className="workspace-search-actions">
              <button
                type="button"
                className="btn-icon-sober"
                title={navigationLabels.previous}
                aria-label={navigationLabels.previous}
                disabled={!canNavigate}
                onClick={() => navigate(-1)}
              >
                <ChevronDownIcon
                  className="workspace-search-previous"
                  size={15}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="btn-icon-sober"
                title={navigationLabels.next}
                aria-label={navigationLabels.next}
                disabled={!canNavigate}
                onClick={() => navigate(1)}
              >
                <ChevronDownIcon size={15} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="workspace-search-status" role="status">
        {status}
        {result?.limited && <p>{labels.limited}</p>}
        {result?.skipped > 0 && <p>{labels.skipped(result.skipped)}</p>}
      </div>
      <div
        className="workspace-search-results"
        onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
          const buttons = [...event.currentTarget.querySelectorAll('button')]
          const index = buttons.indexOf(event.target)
          if (index === -1) return
          event.preventDefault()
          buttons[index + (event.key === 'ArrowUp' ? -1 : 1)]?.focus()
        }}
      >
        {result?.groups.map((group) => (
          <section
            key={group.path}
            className="workspace-search-group"
            aria-label={group.relativePath}
          >
            <div className="workspace-search-file" title={group.path}>
              <FileTextIcon size={13} aria-hidden="true" />
              <span>{group.relativePath}</span>
            </div>
            {group.matches.map((match) => (
              <button
                type="button"
                key={`${match.block}:${match.offset}`}
                className="workspace-search-hit"
                aria-current={match === activeMatch ? 'true' : undefined}
                ref={match === activeMatch ? activeResult : undefined}
                onClick={() => onOpen(group, match)}
              >
                {match.before}
                <mark className={matchClassName(match === activeMatch)}>{match.match}</mark>
                {match.after}
              </button>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
