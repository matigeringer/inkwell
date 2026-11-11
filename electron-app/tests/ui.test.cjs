const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
})
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'HTMLTextAreaElement',
  'Element',
  'Node',
  'DOMParser',
  'MutationObserver',
  'Event',
  'KeyboardEvent',
  'localStorage',
  'getComputedStyle'
]) {
  global[name] = dom.window[name]
}
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator })
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
dom.window.Range.prototype.getClientRects = () => []
dom.window.Range.prototype.getBoundingClientRect = () => ({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  width: 0,
  height: 0
})
global.innerHeight = 800
global.innerWidth = 1200
global.IS_REACT_ACT_ENVIRONMENT = true
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const tiptap = require('@tiptap/react')
const load = require('./load.cjs')
let activeEditor
const Editor = load('src/renderer/src/components/Editor.jsx', {
  '@tiptap/react': {
    ...tiptap,
    useEditor(options) {
      activeEditor = tiptap.useEditor(options)
      return activeEditor
    }
  }
}).default
const { DEFAULT_PREFERENCES } = load('src/renderer/src/lib/preferences.js')
let root

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  root = null
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
})

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}
async function mount(overrides = {}, apiOverrides = {}) {
  const writes = []
  let created = 0
  let closeCallback
  window.api = {
    saveFile: async (data) => {
      writes.push(data)
      return { success: true, filePath: data.filePath || '/saved.md', fileName: 'a.md' }
    },
    historySaveSnapshot: async () => ({ success: true }),
    historyMove: async () => ({ success: true }),
    onRequestClose(callback) {
      closeCallback = callback
      return () => {
        closeCallback = null
      }
    },
    ...apiOverrides
  }
  root = createRoot(document.getElementById('root'))
  await act(async () =>
    root.render(
      React.createElement(Editor, {
        initialDoc: { id: 'doc', filePath: '/a.md', fileName: 'a.md', content: 'original' },
        preferences: { ...DEFAULT_PREFERENCES, autoSaveEnabled: false },
        onNewDoc: () => {
          created++
        },
        ...overrides
      })
    )
  )
  await settle()
  return {
    writes,
    get created() {
      return created
    },
    get close() {
      return closeCallback
    }
  }
}

test('Ctrl+N and native close flush edits even with debounce disabled', async () => {
  const fixture = await mount()
  await act(async () => activeEditor.commands.insertContent(' edit'))
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
  )
  assert.equal(fixture.created, 1)
  assert.equal(fixture.writes.length, 1)
  assert.match(fixture.writes[0].content, /edit/)
  await act(async () => activeEditor.commands.insertContent(' closing'))
  let approved
  await act(async () => {
    approved = await fixture.close()
  })
  assert.equal(approved, true)
  assert.match(fixture.writes.at(-1).content, /closing/)
})

test('a failed write blocks navigation and window close', async () => {
  const fixture = await mount(
    {},
    { saveFile: async () => ({ success: false, error: 'No space left' }) }
  )
  await act(async () => activeEditor.commands.insertContent(' keep'))
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
  )
  assert.equal(fixture.created, 0)
  let approved
  await act(async () => {
    approved = await fixture.close()
  })
  assert.equal(approved, false)
  assert.match(document.body.textContent, /No space left/)
  assert.match(activeEditor.getText(), /keep/)
})

test('source editing preserves unsupported Markdown through navigation', async () => {
  const content = '| A | B |\n|---|---|\n| 1 | 2 |\n\n![alt](https://example.org/image.png)'
  const fixture = await mount({
    initialDoc: { id: 'source', filePath: '/a.md', fileName: 'a.md', content }
  })
  const textarea = document.querySelector('textarea[aria-label="Markdown"]')
  assert.ok(textarea)
  assert.equal(textarea.value, content)
  const edited = content + '\n\nnew paragraph'
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      textarea,
      edited
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
  )
  assert.equal(fixture.writes.at(-1)?.content, edited)
})

test('the outline filters live rich-text headings and distinguishes duplicate titles', async () => {
  const fixture = await mount({
    initialDoc: {
      id: 'outline',
      fileName: 'a.md',
      filePath: '/a.md',
      content: '# Prólogo\n\n## **Introducción**\n\n## Introducción\n\n# Epílogo'
    }
  })
  const headings = () => [...document.querySelectorAll('#document-outline li button')]
  assert.deepEqual(
    headings().map((button) => button.title),
    ['Prólogo', 'Introducción', 'Introducción', 'Epílogo']
  )
  assert.deepEqual(
    headings().map((button) => button.parentElement.style.getPropertyValue('--outline-level')),
    ['1', '2', '2', '1']
  )
  const editorMain = document.querySelector('.editor-main')
  editorMain.scrollTop = 0
  const wheel = new dom.window.WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: 120
  })
  await act(async () => headings()[0].dispatchEvent(wheel))
  assert.equal(wheel.defaultPrevented, true)
  assert.equal(editorMain.scrollTop, 120)

  const toggle = document.querySelector('button[aria-label="Índice del documento"]')
  await act(async () => toggle.click())
  const filter = document.querySelector('#document-outline input')
  assert.equal(document.activeElement, filter)
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
      filter,
      'introduccion'
    )
    filter.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(headings().length, 2)
  assert.equal(headings()[0].parentElement.style.getPropertyValue('--outline-depth'), '1')

  const { doc, selection } = activeEditor.state
  await act(async () => headings()[1].click())
  assert.equal(headings()[1].getAttribute('aria-current'), 'location')
  assert.equal(activeEditor.state.doc, doc)
  assert.ok(activeEditor.state.selection.eq(selection))
  assert.equal(fixture.writes.length, 0)

  await act(async () => activeEditor.commands.setContent('# Una sección', { emitUpdate: false }))
  assert.match(document.querySelector('#document-outline [role="status"]').textContent, /coincidan/)
  await act(async () =>
    filter.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  )
  assert.equal(document.activeElement, toggle)
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.deepEqual(
    headings().map((button) => button.title),
    ['Una sección']
  )
})

test('the source outline reads Markdown headings and skips fenced code and table cells', async () => {
  const content = [
    '# Inicio',
    '',
    '| # Celda |',
    '| --- |',
    '',
    '```md',
    '# Ejemplo',
    '```',
    '',
    '**Apéndice** [y notas](https://example.org)',
    '---',
    '',
    '###### Referencias'
  ].join('\r\n')
  const fixture = await mount({
    initialDoc: { id: 'source-outline', filePath: '/a.md', fileName: 'a.md', content }
  })
  const textarea = document.querySelector('textarea[aria-label="Markdown"]')
  const headings = () => [...document.querySelectorAll('#document-outline li button')]
  assert.deepEqual(
    headings().map((button) => button.title),
    ['Inicio', 'Apéndice y notas', 'Referencias']
  )
  await act(async () => headings()[2].click())
  assert.equal(headings()[2].getAttribute('aria-current'), 'location')
  assert.equal(textarea.value, content.replaceAll('\r\n', '\n'))
  assert.equal(fixture.writes.length, 0)

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      textarea,
      textarea.value + '\n\n## Nuevo subtítulo'
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(headings().at(-1).title, 'Nuevo subtítulo')
})

test('manuscript search navigates across inline formatting without changing the document', async () => {
  const fixture = await mount({
    initialDoc: {
      id: 'search',
      filePath: '/a.md',
      fileName: 'a.md',
      content: '# Brisa\n\nLa bri**sa** sopla. BRISA.'
    }
  })
  await act(async () => new Promise((resolve) => requestAnimationFrame(resolve)))
  const original = activeEditor.state.doc
  const selection = activeEditor.state.selection
  const status = () => document.querySelector('.manuscript-search-count').textContent
  const activeText = () =>
    [...document.querySelectorAll('.tiptap .is-current-match')]
      .map((element) => element.textContent)
      .join('')

  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
  )
  const input = document.querySelector('input[type="search"]')
  assert.ok(document.activeElement === input)
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
      input,
      'brisa'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(status(), '1 de 3')
  assert.equal(activeText(), 'Brisa')
  await act(async () =>
    document.querySelector('button[aria-label="Coincidencia siguiente"]').click()
  )
  assert.equal(status(), '2 de 3')
  assert.equal(activeText(), 'brisa')
  for (const expected of ['3 de 3', '1 de 3']) {
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    )
    assert.equal(status(), expected)
  }
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })
    )
  )
  assert.equal(activeText(), 'BRISA')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  )
  assert.equal(document.querySelector('.manuscript-search'), null)
  assert.equal(document.querySelector('.manuscript-match'), null)
  assert.equal(document.activeElement, activeEditor.view.dom)
  assert.equal(activeEditor.state.doc, original)
  assert.ok(activeEditor.state.selection.eq(selection))
  assert.equal(fixture.writes.length, 0)
})

test('source search matches literal text and refreshes while editing', async () => {
  const content = 'Intro\r\n[a.b] literal\r\n[A.B] literal'
  await mount({ initialDoc: { id: 'source', filePath: '/a.txt', fileName: 'a.txt', content } })
  await act(async () =>
    document.querySelector('button[aria-label="Buscar en el manuscrito"]').click()
  )
  const input = document.querySelector('input[type="search"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
      input,
      '[a.b]'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.deepEqual(
    [...document.querySelectorAll('.source-search-overlay .manuscript-match')].map(
      (element) => element.textContent
    ),
    ['[a.b]', '[A.B]']
  )
  const textarea = document.querySelector('textarea[aria-label="Markdown"]')
  await act(async () => {
    textarea.focus()
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      textarea,
      'Intro\n[axb] literal'
    )
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(document.activeElement, textarea)
  assert.equal(document.querySelector('.manuscript-search-count').textContent, 'Sin coincidencias')
  assert.equal(document.querySelector('.source-search-overlay'), null)
})

test('restore waits for snapshot content and stays dirty with autosave disabled', async () => {
  let finishPreview
  const fixture = await mount(
    {},
    {
      historyGetSnapshots: async () => ({
        success: true,
        snapshots: [{ id: 'snapshot', timestamp: Date.now(), words: 2 }]
      }),
      historyGetSnapshotContent: () =>
        new Promise((resolve) => {
          finishPreview = resolve
        })
    }
  )
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true }))
  )
  await settle()
  const restore =
    document.querySelector('button[title="Restaurar esta versión"]') ||
    [...document.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Restaurar')
    )
  assert.ok(restore)
  assert.equal(restore.disabled, true)
  await act(async () => finishPreview({ success: true, content: 'restored manuscript' }))
  assert.equal(restore.disabled, false)
  await act(async () => restore.click())
  assert.match(activeEditor.getText(), /restored manuscript/)
  assert.equal(fixture.writes.length, 0)
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
  )
  assert.equal(fixture.writes.at(-1).content, 'restored manuscript')
})

test('legacy local drafts remain discoverable after restart', () => {
  localStorage.setItem('fountain_draft_123', 'recover this draft')
  localStorage.setItem('fountain_drafts_v1', 'null')
  const { listDrafts } = load('src/renderer/src/lib/drafts.js')
  const drafts = listDrafts()
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0].id, '123')
  assert.equal(drafts[0].content, 'recover this draft')
})

test('renaming the active file flushes first and subsequent writes use its new path', async () => {
  const operations = []
  const folder = {
    path: '/workspace',
    name: 'workspace',
    tree: [{ path: '/workspace/a.md', name: 'a.md', isDirectory: false }]
  }
  await mount(
    {
      initialDoc: { id: 'doc', filePath: '/workspace/a.md', fileName: 'a.md', content: 'original' },
      openedFolder: folder,
      onRefreshFolderTree: async () => {}
    },
    {
      saveFile: async (data) => {
        operations.push(['save', data.filePath, data.content])
        return { success: true, filePath: data.filePath, fileName: data.filePath.split('/').pop() }
      },
      renameItem: async (data) => {
        operations.push(['rename', data.oldPath])
        return { success: true, oldPath: data.oldPath, newPath: '/workspace/b.md', newName: 'b.md' }
      }
    }
  )
  await act(async () => activeEditor.commands.insertContent(' pending'))
  await act(async () => document.querySelector('button[title="Renombrar archivo"]').click())
  const input = document.querySelector('.tree-inline-input')
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
      input,
      'b.md'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  assert.equal(operations[0][0], 'save')
  assert.equal(operations[1][0], 'rename')
  await act(async () => activeEditor.commands.insertContent(' next'))
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
  )
  assert.equal(operations.at(-1)[1], '/workspace/b.md')
})

test('deleting the active file retains a draft and cannot save to the deleted path', async () => {
  const operations = []
  const folder = {
    path: '/workspace',
    name: 'workspace',
    tree: [{ path: '/workspace/a.md', name: 'a.md', isDirectory: false }]
  }
  await mount(
    {
      initialDoc: {
        id: 'doc',
        filePath: '/workspace/a.md',
        fileName: 'a.md',
        content: 'keep this'
      },
      openedFolder: folder,
      onRefreshFolderTree: async () => {}
    },
    {
      deleteItem: async (targetPath) => ({ success: true, targetPath }),
      saveFile: async (data) => {
        operations.push(data)
        return { success: true, filePath: data.filePath || '/new-copy.md', fileName: 'copy.md' }
      }
    }
  )
  await act(async () => document.querySelector('button[title="Eliminar archivo"]').click())
  await act(async () => document.querySelector('.btn-danger-action').click())
  assert.equal(localStorage.getItem('fountain_draft_doc'), 'keep this')
  await act(async () => activeEditor.commands.insertContent(' more'))
  await act(async () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
  )
  assert.equal(operations.at(-1).filePath, null)
})

test('the home screen exposes recovered drafts and opens their original content', async () => {
  localStorage.setItem('fountain_draft_legacy', 'recovered manuscript')
  window.api = { onRequestClose: () => () => {}, setWindowTheme() {} }
  const App = load('src/renderer/src/App.jsx', {
    '@tiptap/react': {
      ...tiptap,
      useEditor(options) {
        activeEditor = tiptap.useEditor(options)
        return activeEditor
      }
    }
  }).default
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
  const recover = document.querySelector('.recovered-drafts button')
  assert.ok(recover)
  await act(async () => recover.click())
  assert.equal(activeEditor.getText(), 'recovered manuscript')
})

test('the workspace worker and rich editor agree on searchable Markdown blocks', async () => {
  const content = [
    '# Una **brisa**',
    'Palabras con **formato**\ny otra línea.  \nUn salto forzado.',
    '- [x] Una tarea con *brisa*\n- Otra tarea',
    '> [Enlace](https://example.com) con `código`',
    '```txt\n    Código sin recortar\n```'
  ].join('\n\n')
  await mount({ initialDoc: { id: 'search-blocks', filePath: '/a.md', fileName: 'a.md', content } })
  const { searchTextBlocks } = load('src/main/workspaceSearchWorker.js')
  const { manuscriptTextBlocks } = load('src/renderer/src/lib/manuscriptSearch.js')
  assert.deepEqual(
    searchTextBlocks(content, 'a.md'),
    manuscriptTextBlocks(activeEditor.state.doc).map(({ text }) => text)
  )
})

test('folder search has one field and discards batches from superseded queries', async () => {
  localStorage.setItem('fountain_opened_folders', JSON.stringify(['/book', '/other']))
  const pending = []
  const canceled = []
  let onBatch
  window.api = {
    onRequestClose: () => () => {},
    setWindowTheme() {},
    readFolderTree: async (folderPath) => ({
      success: true,
      folderPath,
      folderName: folderPath.slice(1),
      tree: []
    }),
    onFileSearchBatch: (callback) => {
      onBatch = callback
      return () => {}
    },
    cancelFileSearch: async (id) => canceled.push(id),
    searchFiles: (request) => new Promise((resolve) => pending.push({ request, resolve }))
  }
  const App = load('src/renderer/src/App.jsx').default
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(App)))
  await act(async () =>
    document
      .querySelectorAll('.file-tree-header button[aria-label="Buscar en la carpeta"]')[1]
      .click()
  )
  const input = document.querySelector('.workspace-search input[type="search"]')
  assert.ok(document.activeElement === input)
  assert.equal(document.querySelector('.workspace-search-folder').textContent, 'other')
  assert.equal(
    document.querySelectorAll('.workspace-search input, .workspace-search select').length,
    1
  )
  for (const query of ['primera', 'segunda']) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(
        input,
        query
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    if (query === 'primera') {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 220)))
    } else {
      await act(async () =>
        input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      )
    }
  }
  assert.deepEqual(
    pending.map(({ request }) => request.scope),
    [
      { path: '/other', rootPath: '/other' },
      { path: '/other', rootPath: '/other' }
    ]
  )
  assert.deepEqual(canceled, [pending[0].request.id])
  await act(async () => {
    onBatch({
      id: pending[0].request.id,
      count: 1,
      groups: [
        {
          path: '/other/a.md',
          relativePath: 'a.md',
          matches: [{ block: 0, offset: 0, match: 'tardío' }]
        }
      ]
    })
    pending[0].resolve({ canceled: true })
    onBatch({
      id: pending[1].request.id,
      count: 1,
      groups: [
        {
          path: '/other/b.md',
          relativePath: 'b.md',
          matches: [{ block: 0, offset: 0, match: 'actual' }]
        }
      ]
    })
    pending[1].resolve({ success: true, count: 1 })
  })
  assert.equal(document.querySelector('.workspace-search-file').textContent, 'b.md')
  assert.equal(document.querySelector('.workspace-search-hit mark').textContent, 'actual')
})

for (const theme of ['mono', 'beige']) {
  test(`${theme} selection preserves content and writing settings across modes and restart`, async () => {
    const originalMatchMedia = window.matchMedia
    let onSystemChange
    const systemQuery = {
      matches: false,
      addEventListener(_event, callback) {
        onSystemChange = callback
      },
      removeEventListener() {}
    }
    window.matchMedia = (query) =>
      query === '(prefers-color-scheme: dark)' ? systemQuery : originalMatchMedia(query)
    try {
      window.api = { onRequestClose: () => () => {}, setWindowTheme() {} }
      const App = load('src/renderer/src/App.jsx').default
      const start = async () => {
        root = createRoot(document.getElementById('root'))
        await act(async () => root.render(React.createElement(App)))
        await act(async () => document.querySelector('.sidebar-settings-btn').click())
        await act(async () =>
          [...document.querySelectorAll('.segmented-tab-btn')]
            .find((button) => button.textContent === 'Apariencia')
            .click()
        )
      }
      const selectMode = async (name) => {
        await act(async () =>
          [...document.querySelectorAll('.pref-segment-btn')]
            .find((button) => button.textContent === name)
            .click()
        )
      }
      await start()
      const originalText = document.body.textContent
      await act(async () =>
        document.querySelector(`.theme-mockup-screen[data-theme="${theme}-light"]`).click()
      )
      assert.equal(document.body.textContent, originalText)
      assert.equal(document.documentElement.dataset.theme, `${theme}-light`)
      assert.deepEqual(JSON.parse(localStorage.getItem('fountain_preferences')), {
        ...DEFAULT_PREFERENCES,
        theme
      })
      await selectMode('Oscuro')
      assert.equal(document.documentElement.dataset.theme, `${theme}-dark`)
      await act(async () => root.unmount())
      await start()
      assert.equal(document.documentElement.dataset.theme, `${theme}-dark`)
      assert.equal(
        document.querySelector('.theme-mockup-screen[aria-pressed="true"]').dataset.theme,
        `${theme}-dark`
      )
      await selectMode('Sistema')
      assert.equal(document.documentElement.dataset.theme, `${theme}-light`)
      systemQuery.matches = true
      await act(async () => onSystemChange())
      assert.equal(document.documentElement.dataset.theme, `${theme}-dark`)
      await act(async () => document.querySelector('.modal-card .btn-icon-subtle').click())
      await act(async () =>
        document.querySelector('.btn-quick-theme[aria-label="Cambiar modo de apariencia"]').click()
      )
      assert.equal(document.documentElement.dataset.theme, `${theme}-light`)
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
}
