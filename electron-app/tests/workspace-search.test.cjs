const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const load = require('./load.cjs')

const { FileService } = load('src/main/fileService.js')
const { scanWorkspace } = load('src/main/workspaceSearch.js')
const { searchDocumentText } = load('src/main/workspaceSearchWorker.js')
const { locateWorkspaceMatch } = load('src/shared/workspaceMatch.js')

async function fixture(t) {
  const directory = await fs.mkdtemp('/tmp/inkwell-workspace-search-')
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const root = path.join(directory, 'Book')
  const subfolder = path.join(root, 'Chapters')
  const chapter = path.join(subfolder, 'Chapter.md')
  const notes = path.join(root, 'Notes.txt')
  const outside = path.join(directory, 'Private.md')
  await fs.mkdir(subfolder, { recursive: true })
  await fs.writeFile(chapter, 'La bri**sa** llegó. Brisa y brisamar.\n\nCafé, cafe y CAFÉ.')
  await fs.writeFile(notes, 'brisa [a.b]\r\notra línea')
  await fs.writeFile(outside, 'brisa privada')
  await fs.writeFile(path.join(root, 'Binary.txt'), Buffer.from([0, 98]))
  await fs.mkdir(path.join(root, '.hidden'))
  await fs.writeFile(path.join(root, '.hidden', 'Secret.md'), 'brisa oculta')
  const files = new FileService(path.join(directory, 'permissions.json'), fs.unlink)
  await files.grantDirectory(root)
  await files.grantFile(outside)
  if (process.platform !== 'win32') {
    await fs.symlink(outside, path.join(root, 'Link.md'))
    await fs.symlink(subfolder, path.join(root, 'Alias'), 'dir')
  }

  async function run(overrides = {}, options = {}) {
    const groups = []
    const result = await scanWorkspace(
      files,
      { query: 'brisa', scope: { path: root, rootPath: root }, ...overrides },
      {
        signal: new AbortController().signal,
        searchText: searchDocumentText,
        publish: (batch) => groups.push(...batch.groups),
        ...options
      }
    )
    return { result, groups }
  }

  return { run, files, root, subfolder, chapter, notes, outside }
}

test('folder search lists matches and their paths only in the selected directory', async (t) => {
  const { run, files, root, subfolder, chapter, notes, outside } = await fixture(t)
  const all = await run({ activeFile: { path: outside, content: 'brisa privada' } })
  assert.deepEqual(
    all.groups.map(({ path }) => path),
    [chapter, notes]
  )
  assert.deepEqual(
    all.groups[0].matches.map(({ match }) => match),
    ['brisa', 'Brisa', 'brisa']
  )
  assert.equal(all.groups[0].relativePath, path.join('Chapters', 'Chapter.md'))
  assert.equal(all.result.skipped, 1)
  assert.equal(files.versions.size, 0)

  const scoped = await run({ scope: { path: subfolder, rootPath: root } })
  assert.equal(scoped.result.count, 3)
  assert.equal(scoped.groups[0].relativePath, 'Chapter.md')
  assert.equal((await run({ query: 'café' })).result.count, 2)
  const live = await run({ query: 'nuevo', activeFile: { path: chapter, content: 'texto nuevo' } })
  assert.equal(live.groups[0].path, chapter)
  assert.equal((await run({ query: '[a.b]' })).groups[0].matches[0].after, '\notra línea')
  const table = '| Campo |\n|---|\n| [a.b] |'
  assert.equal(
    searchDocumentText({ content: table, fileName: 'Table.md', query: '| [a.b]', limit: 5 }).matches
      .length,
    1
  )

  await assert.rejects(run({ scope: null }), /inválida/)
  await assert.rejects(run({ scope: { path: path.dirname(root), rootPath: root } }), /autorizado/)
  if (process.platform !== 'win32') {
    await assert.rejects(
      run({ scope: { path: path.join(root, 'Alias'), rootPath: root } }),
      /enlaces simbólicos/
    )
  }
})

test('workspace search reports partial reads and limits and cancels without publishing late results', async (t) => {
  const { run } = await fixture(t)
  assert.equal((await run({}, { byteLimit: 1 })).result.limited, true)
  const limited = await run({}, { resultLimit: 1 })
  assert.equal(limited.result.count, 1)
  assert.equal(limited.result.limited, true)

  const controller = new AbortController()
  await assert.rejects(
    run(
      {},
      {
        signal: controller.signal,
        publish: () => assert.fail('canceled results were published'),
        searchText: (request) => {
          controller.abort()
          return searchDocumentText(request)
        }
      }
    ),
    { name: 'AbortError' }
  )
})

test('workspace match navigation verifies context and rejects ambiguous matches in changed files', () => {
  const locator = { block: 0, offset: 4, before: 'La ', match: 'brisa', after: '.' }
  assert.deepEqual(locateWorkspaceMatch([{ start: 12, text: ' La brisa.' }], locator, true), {
    from: 16,
    to: 21
  })
  assert.deepEqual(locateWorkspaceMatch([{ start: 12, text: 'Hoy: La brisa.' }], locator, false), {
    from: 20,
    to: 25
  })
  assert.equal(
    locateWorkspaceMatch([{ start: 12, text: 'La brisa. La brisa.' }], locator, false),
    null
  )
})
