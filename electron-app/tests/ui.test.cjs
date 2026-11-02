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
