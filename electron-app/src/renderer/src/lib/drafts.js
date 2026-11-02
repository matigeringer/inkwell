const PREFIX = 'fountain_draft_'
const INDEX = 'fountain_drafts_v1'

export function listDrafts(storage = localStorage) {
  let index = {}
  try {
    index = JSON.parse(storage.getItem(INDEX) || '{}')
  } catch {
    /* Recover legacy draft keys below. */
  }
  if (!index || typeof index !== 'object' || Array.isArray(index)) index = {}
  const drafts = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    const id = key.slice(PREFIX.length)
    const content = storage.getItem(key)
    if (!content) continue
    drafts.push({
      id,
      filePath: null,
      content,
      fileName: index[id]?.fileName || 'documento.md',
      updatedAt: index[id]?.updatedAt || Number(id) || 0
    })
  }
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveDraft(doc, storage = localStorage) {
  if (!doc.id) throw new Error('Borrador sin identificador')
  storage.setItem(PREFIX + doc.id, doc.content)
  let index = {}
  try {
    index = JSON.parse(storage.getItem(INDEX) || '{}')
  } catch {
    /* Rebuild metadata. */
  }
  if (!index || typeof index !== 'object' || Array.isArray(index)) index = {}
  Object.defineProperty(index, doc.id, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: { fileName: doc.fileName, updatedAt: Date.now() }
  })
  storage.setItem(INDEX, JSON.stringify(index))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fountain-drafts-changed'))
}

export function removeDraft(id, storage = localStorage) {
  storage.removeItem(PREFIX + id)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fountain-drafts-changed'))
}
