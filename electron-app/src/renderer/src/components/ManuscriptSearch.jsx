import { ChevronDownIcon, CloseIcon, SearchIcon } from './Icons'

export default function ManuscriptSearch({ search, labels }) {
  const { query, matches, activeIndex, barRef, inputRef, changeQuery, navigate, close } = search
  const count = matches.length

  return (
    <div
      id="manuscript-search"
      className="manuscript-search"
      role="search"
      aria-label={labels.title}
      ref={barRef}
    >
      <SearchIcon size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        aria-label={labels.title}
        placeholder={labels.placeholder}
        value={query}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => changeQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            navigate(event.shiftKey ? -1 : 1)
          }
        }}
      />
      <span className="manuscript-search-count" role="status">
        {count ? labels.count(activeIndex + 1, count) : query.trim() && labels.noResults}
      </span>
      <div className="manuscript-search-actions">
        <button
          type="button"
          className="btn-icon-sober"
          title={`${labels.previous} (Shift+Enter)`}
          aria-label={labels.previous}
          disabled={count < 2}
          onClick={() => navigate(-1)}
        >
          <ChevronDownIcon className="manuscript-search-previous" size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon-sober"
          title={`${labels.next} (Enter)`}
          aria-label={labels.next}
          disabled={count < 2}
          onClick={() => navigate(1)}
        >
          <ChevronDownIcon size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn-icon-sober"
          title={`${labels.close} (Esc)`}
          aria-label={labels.close}
          onClick={close}
        >
          <CloseIcon size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
