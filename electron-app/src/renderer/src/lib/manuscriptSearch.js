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

export function highlightManuscriptMatches(editor, matches, activeIndex) {
  const { state, view } = editor
  if (!matches.length && searchHighlightsKey.getState(state) === DecorationSet.empty) return

  const decorations = DecorationSet.create(
    state.doc,
    matches.map(({ from, to }, index) =>
      Decoration.inline(from, to, { class: matchClassName(index === activeIndex) })
    )
  )
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
