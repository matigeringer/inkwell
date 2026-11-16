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
  'MouseEvent',
  'KeyboardEvent',
  'localStorage',
  'getComputedStyle'
]) {
  global[name] = dom.window[name]
}
Object.defineProperty(global, 'navigator', { configurable: true, value: dom.window.navigator })
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)
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

async function settle(ms = 15) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function mountEditor(initialThreads = []) {
  const savedComments = []
  let contextMenuListener = null
  const replacedWords = []
  const addedWords = []

  window.api = {
    saveFile: async (data) => ({ success: true, filePath: data.filePath, fileName: 'a.md' }),
    historySaveSnapshot: async () => ({ success: true }),
    historyMove: async () => ({ success: true }),
    commentsGet: async () => ({ success: true, threads: initialThreads }),
    commentsSave: async (payload) => {
      savedComments.push(payload)
      return { success: true, threads: payload.threads }
    },
    commentsMove: async () => ({ success: true }),
    onEditorContextMenu: (cb) => {
      contextMenuListener = cb
      return () => {
        contextMenuListener = null
      }
    },
    replaceMisspelling: async (word) => {
      replacedWords.push(word)
      return { success: true }
    },
    addToDictionary: async (word) => {
      addedWords.push(word)
      return { success: true }
    },
    execEditAction: async () => ({ success: true }),
    onRequestClose: () => () => {}
  }

  root = createRoot(document.getElementById('root'))
  await act(async () =>
    root.render(
      React.createElement(Editor, {
        initialDoc: {
          id: 'doc-comments',
          filePath: '/a.md',
          fileName: 'a.md',
          content: 'Primera frase para comentar aquí.'
        },
        preferences: { ...DEFAULT_PREFERENCES, language: 'es', autoSaveEnabled: false }
      })
    )
  )
  await settle(30)
  return {
    savedComments,
    replacedWords,
    addedWords,
    triggerContextMenu: (payload) => contextMenuListener?.(payload)
  }
}

test('creates multiple comments on the same anchor via Ctrl+Alt+M, edits, deletes, and toggles visibility', async () => {
  const fixture = await mountEditor()

  await act(async () => {
    activeEditor.commands.setTextSelection({ from: 9, to: 14 })
  })
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, altKey: true }))
  })
  await settle(25)

  const input = document.querySelector('.comment-composer-input')
  assert.ok(input, 'Draft comment composer should appear')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(input, 'Primer comentario')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    document.querySelector('.comment-btn-primary').click()
  })
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)
  assert.equal(document.querySelectorAll('[data-comment-id]').length, 1)
  assert.equal(fixture.savedComments.at(-1).threads[0].comments[0].body, 'Primer comentario')

  // No resolve/done button should exist.
  assert.equal(document.querySelector('[aria-label*="resolver" i]'), null)

  // Add a second independent comment to the same fragment.
  await act(async () => {
    document.querySelector('.comment-add-another-btn').click()
  })
  await settle(25)
  const addInput = document.querySelector('.comment-composer-input')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(addInput, 'Segundo comentario en mismo texto')
    addInput.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    document.querySelector('.comment-btn-primary').click()
  })
  await settle(400)
  assert.equal(document.querySelectorAll('.comment-entry').length, 2)
  assert.equal(fixture.savedComments.at(-1).threads[0].comments.length, 2)

  // Edit the first comment.
  const editButtons = document.querySelectorAll('[aria-label="Editar comentario"]')
  await act(async () => {
    editButtons[0].click()
  })
  await settle(25)
  const editInput = document.querySelector('.comment-composer-input')
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(editInput, 'Comentario editado')
    editInput.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    document.querySelector('.comment-btn-primary').click()
  })
  await settle(400)
  assert.equal(fixture.savedComments.at(-1).threads[0].comments[0].body, 'Comentario editado')

  // Toggle hide / show comments.
  const toggleBtn = document.querySelector('.btn-comments-toggle')
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'true')
  await act(async () => {
    toggleBtn.click()
  })
  await settle(25)
  assert.equal(toggleBtn.getAttribute('aria-pressed'), 'false')
  assert.equal(document.querySelectorAll('.comment-bubble').length, 0)
  assert.equal(document.querySelectorAll('[data-comment-id]').length, 0)

  await act(async () => {
    toggleBtn.click()
  })
  await settle(25)
  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)
  assert.equal(document.querySelectorAll('[data-comment-id]').length, 1)

  // Delete both comments; thread & highlight should vanish.
  for (let i = 0; i < 2; i++) {
    await act(async () => {
      document.querySelector('[aria-label="Eliminar comentario"]').click()
    })
    await settle(25)
  }
  await settle(400)
  assert.equal(document.querySelectorAll('.comment-bubble').length, 0)
  assert.equal(document.querySelectorAll('[data-comment-id]').length, 0)
  assert.equal(fixture.savedComments.at(-1).threads.length, 0)
})

test('custom right-click context menu surfaces spellcheck suggestions and comment action', async () => {
  const fixture = await mountEditor()

  await act(async () => {
    activeEditor.commands.setTextSelection({ from: 1, to: 8 })
    const canvas = document.querySelector('.editor-canvas')
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 160 })
    )
    fixture.triggerContextMenu({
      x: 120,
      y: 160,
      misspelledWord: 'comentarr',
      dictionarySuggestions: ['comentar'],
      selectionText: 'Primera',
      editFlags: {
        canUndo: true,
        canRedo: false,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canSelectAll: true
      }
    })
  })
  await settle(25)

  const menu = document.querySelector('.editor-context-menu')
  assert.ok(menu, 'Custom styled context menu should render')
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((el) =>
    el.textContent.trim()
  )
  assert.ok(items.some((text) => text === 'comentar'))
  assert.ok(items.some((text) => text.includes('Comentar')))

  // Click spellcheck suggestion
  await act(async () => {
    menu.querySelector('.is-suggestion').click()
  })
  assert.deepEqual(fixture.replacedWords, ['comentarr'.replace('comentarr', 'comentar')])
  assert.equal(document.querySelector('.editor-context-menu'), null)
})
