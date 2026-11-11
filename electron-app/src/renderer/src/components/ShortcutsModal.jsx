import { Fragment, useState } from 'react'
import { CloseIcon, FeatherIcon, FolderTreeIcon } from './Icons'
import useModalFocus from '../hooks/useModalFocus'

const TABS = [
  { id: 'zen', Icon: FeatherIcon },
  { id: 'workspace', Icon: FolderTreeIcon }
]

const SHORTCUTS = {
  zen: [
    ['saveDoc', ['Ctrl', 'S']],
    ['saveCopy', ['Ctrl', 'Shift', 'S']],
    ['versionHistory', ['Ctrl', 'H']],
    ['toggleTypewriter', ['Ctrl', 'Shift', 'Y']],
    ['toggleStats', ['Ctrl', 'Shift', 'C']],
    ['exitZen', ['Esc'], ['F11']],
    ['preferencesZen', ['Ctrl', ',']],
    ['fontSizeAdjust', ['Ctrl', '+'], ['Ctrl', '-']],
    ['viewShortcuts', ['F1'], ['Ctrl', '/']]
  ],
  workspace: [
    ['newDoc', ['Ctrl', 'N']],
    ['openMarkdown', ['Ctrl', 'O']],
    ['openWorkspace', ['Ctrl', 'Shift', 'O']],
    ['toggleSidebar', ['Ctrl', '\\']],
    ['exportDoc', ['Ctrl', 'Shift', 'E'], ['Ctrl', 'P']],
    ['toggleZen', ['F11'], ['Ctrl', 'Shift', 'F']],
    ['versionHistory', ['Ctrl', 'H']],
    ['preferencesGeneral', ['Ctrl', ',']]
  ]
}

function ShortcutRow({ label, combinations, or }) {
  return (
    <div className="pref-row">
      <div className="pref-row-info">
        <span className="pref-row-title">{label}</span>
      </div>
      <div className="pref-row-control">
        <div className="shortcut-kbd-group">
          {combinations.map((keys, index) => (
            <Fragment key={keys.join(' ')}>
              {index > 0 && <span className="shortcut-kbd-or">{or}</span>}
              {keys.map((key, position) => (
                <Fragment key={key}>
                  {position > 0 && <span className="shortcut-kbd-sep">+</span>}
                  <kbd className="shortcut-kbd">{key}</kbd>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ShortcutsModal({ isZenMode, workspaceSearchEnabled, labels, onClose }) {
  const [tab, setTab] = useState(isZenMode ? 'zen' : 'workspace')
  const dialogRef = useModalFocus(true)
  const { shortcuts, search, workspaceSearch } = labels

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-shortcuts"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.isComposing) return
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <header className="modal-header-wide">
          <div className="modal-header-title-bar">
            <h2 id="shortcuts-title" className="modal-title">
              {shortcuts.title}
            </h2>
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={onClose}
              aria-label={shortcuts.closeTitle}
              title={`${shortcuts.closeTitle} (Esc)`}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <nav className="modal-segmented-nav" aria-label={shortcuts.title}>
            {TABS.map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                className={`segmented-tab-btn ${tab === id ? 'is-active' : ''}`}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                <span>{shortcuts.tabs[id]}</span>
              </button>
            ))}
          </nav>
        </header>

        <div className="modal-body modal-body-wide shortcuts-modal-body">
          <ShortcutRow label={search.title} combinations={[['Ctrl', 'F']]} />
          {workspaceSearchEnabled && (
            <ShortcutRow label={workspaceSearch.title} combinations={[['Ctrl', 'Alt', 'F']]} />
          )}
          <div className="shortcuts-tab-panel">
            {SHORTCUTS[tab].map(([key, ...combinations]) => (
              <ShortcutRow
                key={key}
                label={shortcuts.keys[key]}
                combinations={combinations}
                or={shortcuts.keys.or}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
