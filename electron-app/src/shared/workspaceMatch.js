export function workspacePattern(query) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
}

export const normalizeSource = (text) => text.replace(/\r\n?/g, '\n')

export function locateWorkspaceMatch(blocks, locator, sameVersion) {
  const { block, offset, before, match, after } = locator
  const context = before + match + after
  const start = offset - before.length
  const original = blocks[block]
  if (sameVersion && original?.text.startsWith(context, start)) {
    return { from: original.start + offset, to: original.start + offset + match.length }
  }

  let found = null
  for (const { text, start } of blocks) {
    const index = text.indexOf(context)
    if (index === -1) continue
    if (found || text.indexOf(context, index + 1) !== -1) return null
    const from = start + index + before.length
    found = { from, to: from + match.length }
  }
  return found
}
