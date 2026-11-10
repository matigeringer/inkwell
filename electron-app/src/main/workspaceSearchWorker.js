import { createHash } from 'node:crypto'
import { parentPort } from 'node:worker_threads'
import MarkdownIt from 'markdown-it'
import { needsSourceEditor } from '../renderer/src/lib/markdownSupport'
import { normalizeSource, workspacePattern } from '../shared/workspaceMatch'

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: false })

export function searchTextBlocks(
  content,
  fileName,
  sourceMode = /\.txt$/i.test(fileName) || needsSourceEditor(content)
) {
  if (sourceMode) return [normalizeSource(content)]

  const blocks = []
  const tokens = markdown.parse(content, {})
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'fence' || token.type === 'code_block') {
      blocks.push(token.content.replace(/\n$/, ''))
    } else if (token.type === 'inline') {
      // Tiptap turns hard breaks into inline nodes and collapses ordinary HTML whitespace.
      const lines = ['']
      const children = (token.children ?? []).filter(
        (child) => child.type !== 'text' || child.content !== ''
      )
      for (const [index, child] of children.entries()) {
        if (child.type === 'hardbreak') lines.push('')
        if (child.type === 'softbreak') {
          // Tiptap's Markdown parser removes a leading newline after an HTML element.
          const previous = children[index - 1]?.type ?? ''
          if (previous !== 'code_inline' && !previous.endsWith('_close')) {
            lines[lines.length - 1] += ' '
          }
        }
        if (child.type === 'text' || child.type === 'code_inline') {
          lines[lines.length - 1] += child.content
        }
      }
      if (tokens[index - 2]?.type === 'list_item_open' && /^\[[ xX]\] /.test(token.content)) {
        lines[0] = lines[0].slice(3)
      }
      blocks.push(
        lines.map((line) => line.replace(/[\t\n\r\f ]+/g, ' ').replace(/^ | $/g, '')).join('\n')
      )
    }
  }
  return blocks.filter(Boolean)
}

export function searchDocumentText({ content, fileName, sourceMode, query, limit }) {
  const pattern = workspacePattern(query)
  const blocks = searchTextBlocks(content, fileName, sourceMode)
  const matches = []
  for (const [block, text] of blocks.entries()) {
    for (const match of text.matchAll(pattern)) {
      if (matches.length === limit)
        return { matches, truncated: true, version: fingerprint(content) }
      const offset = match.index
      matches.push({
        block,
        offset,
        before: text.slice(Math.max(0, offset - 48), offset),
        match: match[0],
        after: text.slice(offset + match[0].length, offset + match[0].length + 48)
      })
    }
  }
  return { matches, truncated: false, version: matches.length ? fingerprint(content) : null }
}

function fingerprint(content) {
  return createHash('sha256').update(content).digest('hex')
}

parentPort?.on('message', (request) => {
  try {
    parentPort.postMessage(searchDocumentText(request))
  } catch (error) {
    parentPort.postMessage({ error: error.message })
  }
})
