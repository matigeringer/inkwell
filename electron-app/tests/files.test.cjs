const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const load = require('./load.cjs')
const { FileService, validateName } = load('src/main/fileService.js')

async function fixture(t, trash = fs.unlink) {
  const root = await fs.mkdtemp('/tmp/inkwell-files-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const workspace = path.join(root, 'workspace')
  await fs.mkdir(workspace)
  const service = new FileService(path.join(root, 'grants.json'), trash)
  await service.initialize()
  await service.grantDirectory(workspace)
  return { root, workspace, service }
}

test('rejects traversal, separators, controls and reserved names on every platform', () => {
  for (const name of [
    '../escape.md',
    '..',
    '.',
    'a/b.md',
    'a\\b.md',
    'CON.md',
    'nul',
    'a\0b',
    'name.',
    '  '
  ]) {
    assert.throws(() => validateName(name), /inválido/)
  }
  assert.equal(validateName(' capítulo 1.md '), 'capítulo 1.md')
})

test('requires grants and blocks symlinks escaping an authorized root', async (t) => {
  const { root, workspace, service } = await fixture(t)
  const outside = path.join(root, 'private.md')
  await fs.writeFile(outside, 'private')
  await assert.rejects(service.readFile(outside), /no autorizado/)
  await fs.symlink(root, path.join(workspace, 'escape'))
  await assert.rejects(
    service.readFile(path.join(workspace, 'escape', 'private.md')),
    /no autorizado/
  )
  await assert.rejects(service.create(workspace, '../escape.md'), /inválido/)
  const restored = new FileService(path.join(root, 'grants.json'), fs.unlink)
  await restored.initialize()
  await restored.create(workspace, 'allowed.md')
})

test('exclusive creation and rename preserve existing files and directories', async (t) => {
  const { workspace, service } = await fixture(t)
  const results = await Promise.allSettled([
    service.create(workspace, 'a', false, 'one'),
    service.create(workspace, 'a', false, 'two')
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const first = await fs.readFile(path.join(workspace, 'a.md'), 'utf8')
  await service.create(workspace, 'b', false, 'destination')
  await assert.rejects(service.rename(path.join(workspace, 'a.md'), 'b.md'), /EEXIST/)
  assert.equal(await fs.readFile(path.join(workspace, 'b.md'), 'utf8'), 'destination')
  assert.equal(await fs.readFile(path.join(workspace, 'a.md'), 'utf8'), first)
  await service.create(workspace, 'first', true)
  await service.create(workspace, 'second', true)
  await assert.rejects(service.rename(path.join(workspace, 'first'), 'second'), /EEXIST/)
})

test('directory rename preserves descendants, symlinks and conflict baselines', async (t) => {
  const { workspace, service } = await fixture(t)
  const source = path.join(workspace, 'first')
  await service.create(workspace, 'first', true)
  const doc = await service.create(source, 'a.md', false, 'content')
  await fs.symlink('a.md', path.join(source, 'alias'))
  await service.rename(source, 'second')
  const next = path.join(workspace, 'second', 'a.md')
  await service.saveFile(next, 'edited')
  assert.equal(await fs.readFile(next, 'utf8'), 'edited')
  assert.equal(await fs.readlink(path.join(workspace, 'second', 'alias')), 'a.md')
  await assert.rejects(service.saveFile(doc.filePath, 'stale'), /ENOENT|cambió/)
})

test('external edits and deletion are conflicts; export reads do not reset baselines', async (t) => {
  const { workspace, service } = await fixture(t)
  const file = (await service.create(workspace, 'a.md', false, 'original')).filePath
  await fs.writeFile(file, 'external')
  await service.readFile(file, { remember: false })
  await assert.rejects(service.saveFile(file, 'overwrite'), /cambió/)
  assert.equal(await fs.readFile(file, 'utf8'), 'external')
  await service.readFile(file)
  await service.delete(file)
  await assert.rejects(service.saveFile(file, 'resurrect'), /cambió/)
  await assert.rejects(fs.access(file), /ENOENT/)
})

test('trash failure preserves the entire item', async (t) => {
  const { workspace, service } = await fixture(t, async () => {
    throw new Error('Trash unavailable')
  })
  const file = (await service.create(workspace, 'a.md', false, 'keep')).filePath
  await assert.rejects(service.delete(file), /Trash unavailable/)
  assert.equal(await fs.readFile(file, 'utf8'), 'keep')
})

test('failed atomic replacement preserves the original and cleans its temporary', async (t) => {
  const { workspace } = await fixture(t)
  const file = path.join(workspace, 'a.md')
  await fs.writeFile(file, 'original')
  const mock = {
    ...require('node:fs'),
    promises: {
      ...fs,
      rename: async () => {
        throw new Error('disk failure')
      }
    }
  }
  const { atomicWrite } = load('src/main/storage.js', { 'node:fs': mock })
  await assert.rejects(atomicWrite(file, 'replacement'), /disk failure/)
  assert.equal(await fs.readFile(file, 'utf8'), 'original')
  assert.deepEqual(await fs.readdir(workspace), ['a.md'])
})

test('missing folders are errors and truncated trees are explicitly partial', async (t) => {
  const { workspace, service } = await fixture(t)
  await assert.rejects(service.readTree(path.join(workspace, 'missing')), /ENOENT/)
  let nested = workspace
  for (let i = 0; i < 10; i++) {
    nested = path.join(nested, 'nested')
    await fs.mkdir(nested)
  }
  const result = await service.readTree(workspace)
  assert.equal(result.partial, true)
  assert.ok(result.warnings.length)
})
