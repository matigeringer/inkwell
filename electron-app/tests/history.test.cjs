const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const load = require('./load.cjs')

async function fixture(t) {
  const root = await fs.mkdtemp('/tmp/inkwell-history-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return {
    root,
    history: load('src/main/historyManager.js', { electron: { app: { getPath: () => root } } })
  }
}

test('concurrent snapshot saves retain every successful version', async (t) => {
  const { history } = await fixture(t)
  await history.saveSnapshot({ docKey: 'doc', content: 'initial' })
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      history.saveSnapshot({ docKey: 'doc', content: `version ${i}` })
    )
  )
  assert.ok(results.every((result) => result.success))
  const result = await history.getSnapshots('doc')
  assert.equal(result.snapshots.length, 21)
  for (const snapshot of result.snapshots)
    assert.equal(
      (await history.getSnapshotContent({ docKey: 'doc', snapshotId: snapshot.id })).success,
      true
    )
})

test('corrupt metadata is backed up and reconstructed from preserved snapshots', async (t) => {
  const { root, history } = await fixture(t)
  await history.saveSnapshot({ docKey: 'doc', content: 'keep me' })
  const base = path.join(root, 'fountain_history')
  const directory = path.join(base, (await fs.readdir(base))[0])
  await fs.writeFile(path.join(directory, 'meta.json'), '{broken')
  const result = await history.getSnapshots('doc')
  assert.equal(result.success, true)
  assert.equal(result.snapshots.length, 1)
  assert.ok((await fs.readdir(directory)).some((name) => name.startsWith('meta.corrupt.')))
})

test('snapshot pruning and deletion remain consistent with concurrent saves', async (t) => {
  const { history } = await fixture(t)
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      history.saveSnapshot({ docKey: 'doc', content: `version ${i}`, maxEntries: 5 })
    )
  )
  const before = await history.getSnapshots('doc')
  assert.equal(before.snapshots.length, 5)
  await Promise.all([
    history.pruneAllHistory(5),
    history.deleteSnapshot({ docKey: 'doc', snapshotId: before.snapshots[0].id }),
    history.saveSnapshot({ docKey: 'doc', content: 'last', maxEntries: 5 })
  ])
  const after = await history.getSnapshots('doc')
  assert.equal(after.snapshots.length, 5)
  for (const snapshot of after.snapshots)
    assert.equal(
      (await history.getSnapshotContent({ docKey: 'doc', snapshotId: snapshot.id })).success,
      true
    )
})

test('history moves preserve source recovery copies and destination versions', async (t) => {
  const { history } = await fixture(t)
  await history.saveSnapshot({ docKey: 'draft_x', content: 'draft history' })
  const result = await history.moveDocHistory({
    fromKey: 'draft_x',
    toKey: '/doc.md',
    docName: 'doc.md',
    filePath: '/doc.md'
  })
  assert.equal(result.success, true)
  assert.equal((await history.getSnapshots('/doc.md')).snapshots.length, 1)
  assert.equal((await history.getSnapshots('draft_x')).snapshots.length, 1)
})
