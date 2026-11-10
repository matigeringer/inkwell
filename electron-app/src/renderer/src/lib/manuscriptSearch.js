import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Extension } from '@tiptap/react'

const searchHighlightsKey = new PluginKey('manuscriptSearch')

export const SearchHighlights = Extension.create({
  name: 'manuscriptSearch',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchHighlightsKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (transaction, previous) =>
            transaction.getMeta(searchHighlightsKey) ??
            (transaction.docChanged ? previous.map(transaction.mapping, transaction.doc) : previous)
        },
        props: {
          decorations: (state) => searchHighlightsKey.getState(state)
        }
      })
    ]
  }
})

export function findManuscriptMatches(query, content, doc) {
  if (!query.trim()) return []

  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const matches = []
  const scan = (text, start) => {
    for (const match of text.matchAll(pattern)) {
      const from = start + match.index
      matches.push({ from, to: from + match[0].length })
    }
  }

  if (doc) {
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return
      // Inline formatting splits text nodes without adding document positions.
      scan(node.textBetween(0, node.content.size, '', '\n'), pos + 1)
      return false
    })
  } else {
    scan(content, 0)
  }

  return matches
}

export function matchClassName(isActive) {
  return isActive ? 'manuscript-match is-current-match' : 'manuscript-match'
}

export function highlightManuscriptMatches(editor, matches, activeIndex, workspaceMatch) {
  const { state, view } = editor
  if (
    !matches.length &&
    !workspaceMatch &&
    searchHighlightsKey.getState(state) === DecorationSet.empty
  )
    return

  const ranges = matches.map(({ from, to }, index) =>
    Decoration.inline(from, to, { class: matchClassName(index === activeIndex) })
  )
  if (workspaceMatch) {
    ranges.push(
      Decoration.inline(workspaceMatch.from, workspaceMatch.to, { class: 'workspace-editor-match' })
    )
  }
  const decorations = DecorationSet.create(state.doc, ranges)
  view.dispatch(state.tr.setMeta(searchHighlightsKey, decorations).setMeta('addToHistory', false))
}

export function revealMatch(container, match) {
  const bounds = container.getBoundingClientRect()
  const rect = match.getBoundingClientRect()
  const bottom = bounds.top + container.clientHeight
  if (rect.top < bounds.top || rect.bottom > bottom) {
    container.scrollTop += (rect.top + rect.bottom - bounds.top - bottom) / 2
  }
}

export function manuscriptTextBlocks(doc) {
  const blocks = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    const text = node.textBetween(0, node.content.size, '', '\n')
    if (text) blocks.push({ text, start: pos + 1 })
    return false
  })
  return blocks
}

export function syncSourceOverlay(source, overlay) {
  overlay.style.width = `${source.clientWidth}px`
  overlay.style.height = `${source.clientHeight}px`
  overlay.scrollTop = source.scrollTop
  overlay.scrollLeft = source.scrollLeft
}

export function revealSourceMatch(source, { from, to }, onReveal) {
  const overlay = document.createElement('div')
  overlay.className = 'source-search-overlay fountain-source-editor'
  overlay.style.visibility = 'hidden'
  const match = document.createElement('span')
  const text = source.value
  match.textContent = text.slice(from, to)
  overlay.append(text.slice(0, from), match, text.slice(to), text.endsWith('\n') ? '\u200b' : '')
  source.before(overlay)
  try {
    source.setSelectionRange(from, from)
    syncSourceOverlay(source, overlay)
    revealMatch(source, match)
    syncSourceOverlay(source, overlay)
    onReveal(match)
  } finally {
    overlay.remove()
  }
}
