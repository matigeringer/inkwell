const { test } = require('node:test')
const assert = require('node:assert/strict')
const load = require('./load.cjs')
const { DocumentSession } = load('src/renderer/src/lib/documentSession.js')

function fixture(api = {}, extra = {}) {
  return new DocumentSession(
    { id: 'draft', filePath: '/a.md', fileName: 'a.md', content: 'original' },
    {
      api,
      saveDraft: async () => {},
      removeDraft: () => {},
      ...extra
    }
  )
}

test('an old save response cannot mark a newer revision as persisted', async () => {
  let resolve
  const session = fixture({
    saveFile: () =>
      new Promise((done) => {
        resolve = done
      })
  })
  session.change('first')
  const save = session.save()
  await Promise.resolve()
  session.change('second')
  resolve({ success: true, filePath: '/a.md', fileName: 'a.md' })
  await save
  assert.equal(session.dirty, true)
  assert.equal(session.state.status, 'unsaved')
})

test('canceling Save As preserves modifications and location', async () => {
  const session = fixture({ saveFileAs: async () => ({ canceled: true }) })
  session.change('edited')
  assert.equal(await session.save({ saveAs: true }), false)
  assert.equal(session.dirty, true)
  assert.equal(session.state.filePath, '/a.md')
})

test('writes queued behind Save As use the new location and latest revision', async () => {
  let finish
  const writes = []
  const session = fixture({
    saveFileAs: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    saveFile: async (data) => {
      writes.push(data)
      return { success: true, filePath: data.filePath, fileName: 'b.md' }
    }
  })
  session.change('first')
  const copying = session.save({ saveAs: true })
  await Promise.resolve()
  session.change('second')
  const queued = session.save()
  finish({ success: true, filePath: '/b.md', fileName: 'b.md' })
  await Promise.all([copying, queued])
  assert.equal(writes[0].filePath, '/b.md')
  assert.equal(writes[0].content, 'second')
  assert.equal(session.dirty, false)
})

test('flush blocks a transition on backend failure and supports recovery', async () => {
  let fail = true
  const session = fixture({
    saveFile: async () =>
      fail
        ? { success: false, error: 'No space' }
        : { success: true, filePath: '/a.md', fileName: 'a.md' }
  })
  session.change('edited')
  await assert.rejects(session.flush(), /No space/)
  assert.equal(session.dirty, true)
  assert.equal(session.state.status, 'error')
  fail = false
  assert.equal(await session.flush(), true)
  assert.equal(session.dirty, false)
})

test('restored content remains dirty until explicitly flushed', async () => {
  let writes = 0
  const session = fixture({
    saveFile: async () => {
      writes++
      return { success: true, filePath: '/a.md', fileName: 'a.md' }
    }
  })
  session.change('restored snapshot')
  assert.equal(writes, 0)
  assert.equal(session.dirty, true)
  await session.flush()
  assert.equal(writes, 1)
})

test('a storage quota failure never reports a draft as saved', async () => {
  const session = new DocumentSession(
    { id: 'new', content: '' },
    {
      api: {},
      saveDraft: () => {
        throw new Error('quota')
      }
    }
  )
  session.change('valuable text')
  await assert.rejects(session.flush(), /quota/)
  assert.equal(session.state.status, 'error')
  assert.equal(session.dirty, true)
})
