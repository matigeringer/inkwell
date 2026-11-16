const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const load = require('./load.cjs')

async function managerFixture(t) {
  const root = await fs.mkdtemp('/tmp/inkwell-comments-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return {
    root,
    comments: load('src/main/commentsManager.js', { electron: { app: { getPath: () => root } } })
  }
}

const {
  createAnchorFromTextOffsets,
  resolveAnchorInText,
  findWordRangeAtOffset,
  layoutCommentBubbles
} = load('src/renderer/src/lib/documentComments.js')

test('commentsManager persists, sanitizes, backs up corrupt files, and deletes when empty', async (t) => {
  const { root, comments } = await managerFixture(t)
  const docKey = '/manuscripts/chapter-1.md'

  const saved = await comments.saveDocComments({
    docKey,
    docName: 'chapter-1.md',
    filePath: docKey,
    threads: [
      {
        id: 't1',
        anchor: { quote: 'hello world', prefix: 'say ', suffix: '!', fromOffset: 4, toOffset: 15 },
        comments: [
          { id: 'c1', body: '  First note  ', createdAt: 1000, updatedAt: 1000 },
          { id: 'c2', body: '   ', createdAt: 1001, updatedAt: 1001 }
        ],
        createdAt: 1000
      },
      {
        id: 't-empty',
        anchor: { quote: 'ignored', prefix: '', suffix: '', fromOffset: 0, toOffset: 7 },
        comments: [],
        createdAt: 1002
      }
    ]
  })
  assert.equal(saved.success, true)
  assert.equal(saved.threads.length, 1)
  assert.equal(saved.threads[0].comments.length, 1)
  assert.equal(saved.threads[0].comments[0].body, 'First note')

  const loaded = await comments.getDocComments(docKey)
  assert.equal(loaded.success, true)
  assert.equal(loaded.threads.length, 1)
  assert.equal(loaded.threads[0].anchor.quote, 'hello world')

  const base = path.join(root, 'fountain_comments')
  const dir = path.join(base, (await fs.readdir(base))[0])
  await fs.writeFile(path.join(dir, 'comments.json'), '{not-valid-json')
  const corruptRead = await comments.getDocComments(docKey)
  assert.equal(corruptRead.success, true)
  assert.deepEqual(corruptRead.threads, [])
  assert.ok((await fs.readdir(dir)).some((name) => name.startsWith('comments.corrupt.')))

  await comments.saveDocComments({
    docKey,
    docName: 'chapter-1.md',
    filePath: docKey,
    threads: saved.threads
  })
  const cleared = await comments.saveDocComments({
    docKey,
    docName: 'chapter-1.md',
    filePath: docKey,
    threads: []
  })
  assert.equal(cleared.success, true)
  assert.deepEqual((await comments.getDocComments(docKey)).threads, [])
})

test('commentsManager moves comments from drafts and across folder renames', async (t) => {
  const { comments } = await managerFixture(t)
  await comments.saveDocComments({
    docKey: 'draft_1',
    docName: 'borrador.md',
    filePath: null,
    threads: [
      {
        id: 't1',
        anchor: { quote: 'draft phrase', prefix: '', suffix: '', fromOffset: 0, toOffset: 12 },
        comments: [{ id: 'c1', body: 'Keep across save', createdAt: 100, updatedAt: 100 }],
        createdAt: 100
      }
    ]
  })

  const moved = await comments.moveDocComments({
    fromKey: 'draft_1',
    toKey: '/books/novel/ch1.md',
    docName: 'ch1.md',
    filePath: '/books/novel/ch1.md'
  })
  assert.equal(moved.success, true)
  assert.equal((await comments.getDocComments('draft_1')).threads.length, 0)
  assert.equal((await comments.getDocComments('/books/novel/ch1.md')).threads.length, 1)

  const renamed = await comments.moveCommentsPaths('/books/novel', '/books/trilogy')
  assert.equal(renamed.success, true)
  assert.equal((await comments.getDocComments('/books/novel/ch1.md')).threads.length, 0)
  assert.equal((await comments.getDocComments('/books/trilogy/ch1.md')).threads.length, 1)
})

test('resolveAnchorInText re-anchors edited documents via context and marks deleted text orphaned', () => {
  const original = 'En un lugar de la Mancha. En un lugar distinto.'
  const start = original.lastIndexOf('lugar')
  const anchor = createAnchorFromTextOffsets(original, start, start + 5)

  const shifted = 'Prólogo agregado.\n\n' + original
  const resolved = resolveAnchorInText(shifted, anchor)
  assert.equal(resolved.orphaned, false)
  assert.equal(shifted.slice(resolved.fromOffset, resolved.toOffset), 'lugar')
  assert.equal(resolved.fromOffset, shifted.lastIndexOf('lugar'))

  const deleted = 'Texto completamente distinto sin la palabra clave.'
  const orphaned = resolveAnchorInText(deleted, anchor)
  assert.equal(orphaned.orphaned, true)
})

test('findWordRangeAtOffset expands Unicode words cleanly', () => {
  const text = 'Una palabra acentuada: canción.'
  const idx = text.indexOf('canción') + 3
  const range = findWordRangeAtOffset(text, idx)
  assert.deepEqual(text.slice(range.fromOffset, range.toOffset), 'canción')
  assert.equal(findWordRangeAtOffset('   ', 1), null)
})

test('layoutCommentBubbles prevents vertical overlap and prioritizes active bubble', () => {
  const { positions } = layoutCommentBubbles(
    [
      { id: 'a', targetY: 100, height: 80 },
      { id: 'b', targetY: 120, height: 80 },
      { id: 'c', targetY: 150, height: 80 }
    ],
    { gap: 12, activeId: 'b' }
  )
  assert.equal(positions.get('b'), 120)
  assert.ok(positions.get('a') + 80 + 12 <= positions.get('b'))
  assert.ok(positions.get('b') + 80 + 12 <= positions.get('c'))
  assert.ok(positions.get('a') >= 0)
})
