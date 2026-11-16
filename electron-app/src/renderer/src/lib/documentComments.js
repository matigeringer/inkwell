import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Extension } from '@tiptap/react'

export const commentHighlightsKey = new PluginKey('documentComments')

function buildDecorations(
  doc,
  { ranges = [], activeThreadId = null, hoveredThreadId = null, visible = true }
) {
  if (!visible || !ranges.length) return DecorationSet.empty
  const decorations = []
  const maxPos = doc.content.size
  for (const range of ranges) {
    if (range.orphaned) continue
    const from = Math.max(0, Math.min(range.from, maxPos))
    const to = Math.max(0, Math.min(range.to, maxPos))
    if (from >= to) continue
    const classes = ['comment-anchor-mark']
    if (range.threadId === activeThreadId) classes.push('is-active')
    if (range.threadId === hoveredThreadId) classes.push('is-hovered')
    decorations.push(
      Decoration.inline(from, to, {
        class: classes.join(' '),
        'data-comment-id': range.threadId
      })
    )
  }
  return decorations.length ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

export const CommentHighlights = Extension.create({
  name: 'documentComments',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: commentHighlightsKey,
        state: {
          init: () => ({
            ranges: [],
            activeThreadId: null,
            hoveredThreadId: null,
            visible: true,
            decorations: DecorationSet.empty
          }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(commentHighlightsKey)
            if (meta) {
              const next = {
                ranges: meta.ranges ?? prev.ranges,
                activeThreadId:
                  meta.activeThreadId !== undefined ? meta.activeThreadId : prev.activeThreadId,
                hoveredThreadId:
                  meta.hoveredThreadId !== undefined ? meta.hoveredThreadId : prev.hoveredThreadId,
                visible: meta.visible !== undefined ? meta.visible : prev.visible
              }
              return {
                ...next,
                decorations: buildDecorations(tr.doc, next)
              }
            }
            if (tr.docChanged && prev.ranges.length) {
              const ranges = prev.ranges.map((range) => {
                if (range.orphaned) return range
                const from = tr.mapping.map(range.from, 1)
                const to = tr.mapping.map(range.to, -1)
                return from < to
                  ? { ...range, from, to }
                  : { ...range, from, to: from, orphaned: true }
              })
              const next = { ...prev, ranges }
              return {
                ...next,
                decorations: buildDecorations(tr.doc, next)
              }
            }
            return prev
          }
        },
        props: {
          decorations: (state) =>
            commentHighlightsKey.getState(state)?.decorations ?? DecorationSet.empty
        }
      })
    ]
  }
})

export function syncCommentHighlights(editor, state) {
  if (!editor || editor.isDestroyed) return
  const current = commentHighlightsKey.getState(editor.state)
  if (!current) return
  editor.view.dispatch(
    editor.state.tr.setMeta(commentHighlightsKey, state).setMeta('addToHistory', false)
  )
}

export function getMappedCommentRanges(editor) {
  if (!editor || editor.isDestroyed) return []
  return commentHighlightsKey.getState(editor.state)?.ranges ?? []
}

export function collectTextSegments(doc) {
  const segments = []
  let flatOffset = 0
  let firstBlock = true

  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (!firstBlock) {
        flatOffset += 1
      }
      firstBlock = false
      return true
    }
    if (node.isText) {
      const text = node.text || ''
      segments.push({
        pmFrom: pos,
        pmTo: pos + text.length,
        flatFrom: flatOffset,
        flatTo: flatOffset + text.length,
        text
      })
      flatOffset += text.length
      return false
    }
    if (node.isInline && node.isLeaf) {
      flatOffset += 1
      return false
    }
    return true
  })

  return { segments, totalLength: flatOffset }
}

export function extractPlainDocumentText(doc) {
  const { segments } = collectTextSegments(doc)
  if (!segments.length) return ''
  let result = ''
  let cursor = 0
  for (const segment of segments) {
    if (segment.flatFrom > cursor) {
      result += '\n'.repeat(segment.flatFrom - cursor)
    }
    result += segment.text
    cursor = segment.flatTo
  }
  return result
}

export function pmPosToFlatOffset(doc, pos) {
  const { segments, totalLength } = collectTextSegments(doc)
  for (const segment of segments) {
    if (pos <= segment.pmFrom) return segment.flatFrom
    if (pos <= segment.pmTo) return segment.flatFrom + (pos - segment.pmFrom)
  }
  return totalLength
}

export function flatOffsetToPmPos(doc, offset) {
  const { segments } = collectTextSegments(doc)
  if (!segments.length) return Math.min(1, doc.content.size)
  const clamped = Math.max(0, offset)
  for (const segment of segments) {
    if (clamped <= segment.flatFrom) return segment.pmFrom
    if (clamped <= segment.flatTo) return segment.pmFrom + (clamped - segment.flatFrom)
  }
  return segments.at(-1).pmTo
}

export function createAnchorFromTextOffsets(text, fromOffset, toOffset) {
  const start = Math.max(0, Math.min(fromOffset, text.length))
  const end = Math.max(start, Math.min(toOffset, text.length))
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - 32), start),
    suffix: text.slice(end, Math.min(text.length, end + 32)),
    fromOffset: start,
    toOffset: end
  }
}

export function createAnchorFromPmRange(doc, from, to) {
  const text = extractPlainDocumentText(doc)
  const fromOffset = pmPosToFlatOffset(doc, from)
  const toOffset = pmPosToFlatOffset(doc, to)
  return createAnchorFromTextOffsets(text, fromOffset, toOffset)
}

function commonSuffixLength(a, b) {
  const limit = Math.min(a.length, b.length)
  let count = 0
  while (count < limit && a[a.length - 1 - count] === b[b.length - 1 - count]) count++
  return count
}

function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length)
  let count = 0
  while (count < limit && a[count] === b[count]) count++
  return count
}

export function resolveAnchorInText(text, anchor) {
  const quote = anchor?.quote || ''
  if (!quote || !text) {
    const clamped = Math.max(0, Math.min(anchor?.fromOffset || 0, text?.length || 0))
    return { fromOffset: clamped, toOffset: clamped, orphaned: true }
  }

  const expectedFrom = Math.max(0, Math.min(anchor.fromOffset || 0, text.length))
  if (text.slice(expectedFrom, expectedFrom + quote.length) === quote) {
    return { fromOffset: expectedFrom, toOffset: expectedFrom + quote.length, orphaned: false }
  }

  const prefix = anchor.prefix || ''
  const suffix = anchor.suffix || ''
  let bestIdx = -1
  let bestScore = -Infinity
  let searchFrom = 0

  while (searchFrom <= text.length - quote.length) {
    const idx = text.indexOf(quote, searchFrom)
    if (idx === -1) break
    const actualPrefix = text.slice(Math.max(0, idx - prefix.length), idx)
    const actualSuffix = text.slice(idx + quote.length, idx + quote.length + suffix.length)
    const prefixScore = prefix
      ? actualPrefix === prefix
        ? 1000
        : commonSuffixLength(prefix, actualPrefix) * 10
      : 0
    const suffixScore = suffix
      ? actualSuffix === suffix
        ? 1000
        : commonPrefixLength(suffix, actualSuffix) * 10
      : 0
    const score = prefixScore + suffixScore - Math.abs(idx - expectedFrom) * 0.001
    if (score > bestScore) {
      bestScore = score
      bestIdx = idx
    }
    searchFrom = idx + 1
  }

  if (bestIdx !== -1) {
    return { fromOffset: bestIdx, toOffset: bestIdx + quote.length, orphaned: false }
  }

  return { fromOffset: expectedFrom, toOffset: expectedFrom, orphaned: true }
}

export function resolveThreadsInDoc(doc, threads) {
  const text = extractPlainDocumentText(doc)
  return threads.map((thread) => {
    const resolved = resolveAnchorInText(text, thread.anchor)
    if (resolved.orphaned) {
      const fallbackPos = flatOffsetToPmPos(doc, resolved.fromOffset)
      return {
        threadId: thread.id,
        from: fallbackPos,
        to: fallbackPos,
        fromOffset: resolved.fromOffset,
        toOffset: resolved.toOffset,
        orphaned: true
      }
    }
    const from = flatOffsetToPmPos(doc, resolved.fromOffset)
    const to = flatOffsetToPmPos(doc, resolved.toOffset)
    return {
      threadId: thread.id,
      from,
      to: Math.max(from, to),
      fromOffset: resolved.fromOffset,
      toOffset: resolved.toOffset,
      orphaned: from >= to
    }
  })
}

export function findWordRangeAtOffset(text, offset) {
  if (!text) return null
  const wordChar = /[\p{L}\p{N}_'-]/u
  let pos = Math.max(0, Math.min(offset, text.length))
  if (pos === text.length || !wordChar.test(text[pos])) {
    if (pos > 0 && wordChar.test(text[pos - 1])) {
      pos -= 1
    } else {
      return null
    }
  }
  let start = pos
  let end = pos + 1
  while (start > 0 && wordChar.test(text[start - 1])) start--
  while (end < text.length && wordChar.test(text[end])) end++
  return start < end ? { fromOffset: start, toOffset: end } : null
}

export function layoutCommentBubbles(items, { gap = 12, activeId = null } = {}) {
  if (!items.length) return { positions: new Map(), totalHeight: 0 }

  const sorted = [...items].sort((a, b) => a.targetY - b.targetY)
  const placed = new Array(sorted.length)
  const activeIndex = activeId ? sorted.findIndex((item) => item.id === activeId) : -1

  if (activeIndex !== -1) {
    placed[activeIndex] = Math.max(0, sorted[activeIndex].targetY)
    for (let i = activeIndex - 1; i >= 0; i--) {
      const maxBottom = placed[i + 1] - gap
      placed[i] = Math.min(sorted[i].targetY, maxBottom - sorted[i].height)
    }
    if (placed[0] < 0) {
      const shift = -placed[0]
      for (let i = 0; i <= activeIndex; i++) placed[i] += shift
    }
    for (let i = activeIndex + 1; i < sorted.length; i++) {
      const minTop = placed[i - 1] + sorted[i - 1].height + gap
      placed[i] = Math.max(sorted[i].targetY, minTop)
    }
  } else {
    let cursor = 0
    for (let i = 0; i < sorted.length; i++) {
      const top = Math.max(0, sorted[i].targetY, cursor)
      placed[i] = top
      cursor = top + sorted[i].height + gap
    }
  }

  const positions = new Map()
  let totalHeight = 0
  for (let i = 0; i < sorted.length; i++) {
    positions.set(sorted[i].id, placed[i])
    totalHeight = Math.max(totalHeight, placed[i] + sorted[i].height)
  }

  return { positions, totalHeight }
}
