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

async function mountEditor(initialThreads = [], options = {}) {
  const savedComments = []
  let contextMenuListener = null
  const replacedWords = []
  const addedWords = []
  const fileName = options.fileName || 'a.md'
  const filePath = options.filePath || `/${fileName}`
  const content = options.content ?? 'Primera frase para comentar aquí.'

  window.api = {
    saveFile: async (data) => ({ success: true, filePath: data.filePath, fileName }),
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
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Editor, {
          initialDoc: {
            id: 'doc-comments',
            filePath,
            fileName,
            content
          },
          preferences: { ...DEFAULT_PREFERENCES, language: 'es', autoSaveEnabled: false }
        })
      )
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
  await settle(40)
  assert.deepEqual(fixture.replacedWords, ['comentar'])
  assert.equal(document.querySelector('.editor-context-menu'), null)
})

test('drag-selecting onto canvas padding preserves non-empty editor selection', async () => {
  await mountEditor()

  await act(async () => {
    activeEditor.commands.setTextSelection({ from: 1, to: 15 })
  })
  const canvas = document.querySelector('.editor-canvas')
  await act(async () => {
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 20 }))
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 180, clientY: 24 }))
  })
  await settle(25)
  assert.equal(activeEditor.state.selection.from, 1)
  assert.equal(activeEditor.state.selection.to, 15)
})

test('spellcheck suggestion replaces misspelled word when selected or when caret is elsewhere', async () => {
  const fixture = await mountEditor()
  await act(async () => {
    activeEditor.commands.setContent('Texto con errror de tipeo')
    // Select "errror " with trailing space (like double-click) and right-click
    activeEditor.commands.setTextSelection({ from: 11, to: 18 })
    fixture.triggerContextMenu({
      x: 100,
      y: 120,
      misspelledWord: 'errror',
      dictionarySuggestions: ['error'],
      selectionText: 'errror ',
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
  await act(async () => {
    document.querySelector('.editor-context-menu .is-suggestion').click()
  })
  await settle(30)
  assert.equal(activeEditor.state.doc.textContent, 'Texto con error de tipeo')
})

test('clicking text body or selecting word leaves comment unselected; clicking underline selects it', async () => {
  await mountEditor([
    {
      id: 't1',
      anchor: { quote: 'frase', prefix: 'Primera ', suffix: ' para', fromOffset: 8, toOffset: 13 },
      comments: [{ id: 'c1', body: 'Nota', createdAt: 100, updatedAt: 100 }],
      createdAt: 100
    }
  ])

  const mark = document.querySelector('[data-comment-id="t1"]')
  assert.ok(mark, 'Comment highlight should render in StrictMode')
  mark.getClientRects = () => [
    { left: 50, right: 120, top: 100, bottom: 128, width: 70, height: 28 }
  ]

  // Click on the upper/middle text body (y = 110): should NOT activate the comment.
  await act(async () => {
    mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 80, clientY: 110 }))
    mark.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 80, clientY: 110 }))
  })
  await settle(20)
  assert.equal(document.querySelector('.comment-bubble.is-active'), null)
  assert.equal(document.querySelector('.comment-add-another-btn'), null)

  // Click on the underline strip (y = 126, near bottom = 128): SHOULD activate the comment.
  await act(async () => {
    mark.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 80, clientY: 126 }))
    mark.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 80, clientY: 126 }))
  })
  await settle(20)
  assert.ok(document.querySelector('.comment-bubble.is-active'))
  assert.ok(document.querySelector('.comment-add-another-btn'))

  // Clicking outside the comment deselects it and hides the add-comment button.
  await act(async () => {
    document
      .querySelector('.editor-canvas')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }))
  })
  await settle(20)
  assert.equal(document.querySelector('.comment-bubble.is-active'), null)
  assert.equal(document.querySelector('.comment-add-another-btn'), null)
})

test('clicking floating selection comment bubble opens draft composer across mousedown/mouseup/click', async () => {
  const fixture = await mountEditor()

  const stage = document.querySelector('.editor-page-stage')
  stage.getBoundingClientRect = () => ({
    left: 0,
    right: 900,
    top: 0,
    bottom: 700,
    width: 900,
    height: 700
  })
  activeEditor.view.coordsAtPos = () => ({
    left: 180,
    right: 220,
    top: 120,
    bottom: 144
  })

  // Focus editor and select text with a mouse drag.
  await act(async () => {
    activeEditor.commands.focus()
    activeEditor.view.dom.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 130 }))
    activeEditor.commands.setTextSelection({ from: 9, to: 14 })
  })
  await settle(20)
  assert.equal(document.querySelector('.comment-selection-bubble'), null)

  await act(async () => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 220, clientY: 130 }))
  })
  await settle(25)

  const bubble = document.querySelector('.comment-selection-bubble')
  assert.ok(bubble, 'Selection comment bubble should appear after releasing selection drag')

  // Simulate a real pointer click on a child element across separate ticks (mousedown -> settle -> mouseup -> click).
  const labelSpan = bubble.querySelector('span')
  await act(async () => {
    labelSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  })
  await settle(20)

  const bubbleStillMounted = document.querySelector('.comment-selection-bubble')
  assert.ok(bubbleStillMounted, 'Selection bubble must stay mounted on mousedown so click can fire')

  await act(async () => {
    labelSpan.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    labelSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await settle(25)

  const input = document.querySelector('.comment-composer-input')
  assert.ok(input, 'Draft comment composer should open after clicking the selection bubble')
  assert.equal(document.querySelector('.comment-selection-bubble'), null)

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(input, 'Desde el botón emergente')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    document.querySelector('.comment-btn-primary').click()
  })
  await settle(400)
  assert.equal(fixture.savedComments.at(-1).threads[0].comments[0].body, 'Desde el botón emergente')

  // Dismissing a right-click context menu before mouseup must not leave pointerDownRef stuck.
  await act(async () => {
    activeEditor.commands.focus()
    activeEditor.view.dom.dispatchEvent(new Event('focus'))
    activeEditor.commands.setTextSelection({ from: 1, to: 8 })
    window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }))
    fixture.triggerContextMenu({
      x: 120,
      y: 160,
      misspelledWord: '',
      dictionarySuggestions: [],
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
  assert.ok(document.querySelector('.editor-context-menu'))

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  await settle(25)
  assert.equal(document.querySelector('.editor-context-menu'), null)
  assert.ok(
    document.querySelector('.comment-selection-bubble'),
    'Selection bubble should recover after closing context menu'
  )
})

test('editing or replacing commented text re-anchors cleanly without warning banner', async () => {
  const fixture = await mountEditor([
    {
      id: 't1',
      anchor: {
        quote: 'frase',
        prefix: 'Primera ',
        suffix: ' para comentar aquí.',
        fromOffset: 8,
        toOffset: 13
      },
      comments: [{ id: 'c1', body: 'Revisar término', createdAt: 100, updatedAt: 100 }],
      createdAt: 100
    }
  ])

  assert.equal(document.querySelector('.comment-orphaned-banner'), null)
  assert.equal(document.querySelector('.comment-bubble.is-orphaned'), null)

  // Replace the entire commented word "frase" (positions 9..14) with "oración"
  await act(async () => {
    activeEditor.chain().setTextSelection({ from: 9, to: 14 }).insertContent('oración').run()
  })
  await settle(400)

  assert.equal(document.querySelector('.comment-orphaned-banner'), null)
  assert.equal(document.querySelector('.comment-bubble.is-orphaned'), null)
  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)
  const mark = document.querySelector('[data-comment-id="t1"]')
  assert.ok(mark, 'Highlight should remain anchored after replacing commented text')
  assert.equal(mark.textContent, 'oración')
  assert.equal(fixture.savedComments.at(-1).threads[0].anchor.quote, 'oración')
})

test('deleting commented text removes the comment automatically and undo restores it', async () => {
  const fixture = await mountEditor([
    {
      id: 't1',
      anchor: {
        quote: 'frase',
        prefix: 'Primera ',
        suffix: ' para comentar aquí.',
        fromOffset: 8,
        toOffset: 13
      },
      comments: [{ id: 'c1', body: 'Nota temporal', createdAt: 100, updatedAt: 100 }],
      createdAt: 100
    }
  ])

  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)

  // Delete the commented word completely.
  await act(async () => {
    activeEditor.chain().setTextSelection({ from: 9, to: 14 }).deleteSelection().run()
  })
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 0)
  assert.equal(document.querySelectorAll('[data-comment-id]').length, 0)
  assert.equal(document.querySelector('.comment-orphaned-banner'), null)
  assert.equal(fixture.savedComments.at(-1).threads.length, 0)

  // Undo restores both the deleted text and its comment.
  await act(async () => {
    activeEditor.commands.undo()
  })
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)
  const restoredMark = document.querySelector('[data-comment-id="t1"]')
  assert.ok(restoredMark, 'Comment highlight should restore on undo')
  assert.equal(restoredMark.textContent, 'frase')
  assert.equal(fixture.savedComments.at(-1).threads.length, 1)
})

test('loading a document with externally deleted fragment prunes orphaned comment without warning', async () => {
  const fixture = await mountEditor([
    {
      id: 't-missing',
      anchor: {
        quote: 'texto inexistente',
        prefix: 'antes ',
        suffix: ' después',
        fromOffset: 0,
        toOffset: 17
      },
      comments: [{ id: 'c1', body: 'Huérfano', createdAt: 100, updatedAt: 100 }],
      createdAt: 100
    }
  ])
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 0)
  assert.equal(document.querySelector('.comment-orphaned-banner'), null)
  assert.equal(fixture.savedComments.at(-1).threads.length, 0)
})

test('source mode edits re-anchor modified fragment and remove comment when deleted', async () => {
  const fixture = await mountEditor(
    [
      {
        id: 't1',
        anchor: {
          quote: 'frase',
          prefix: 'Primera ',
          suffix: ' para comentar aquí.',
          fromOffset: 8,
          toOffset: 13
        },
        comments: [{ id: 'c1', body: 'En modo fuente', createdAt: 100, updatedAt: 100 }],
        createdAt: 100
      }
    ],
    { fileName: 'nota.txt', content: 'Primera frase para comentar aquí.' }
  )

  const textarea = document.querySelector('textarea')
  assert.ok(textarea, 'Source textarea should render for .txt file')
  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)

  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  await act(async () => {
    setter.call(textarea, 'Primera oración para comentar aquí.')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 1)
  assert.equal(document.querySelector('.comment-orphaned-banner'), null)
  assert.equal(fixture.savedComments.at(-1).threads[0].anchor.quote, 'oración')

  await act(async () => {
    setter.call(textarea, 'Primera  para comentar aquí.')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settle(400)

  assert.equal(document.querySelectorAll('.comment-bubble').length, 0)
  assert.equal(fixture.savedComments.at(-1).threads.length, 0)
})

test('comment bubble aligns vertically with the commented text without rail margin offset', async () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const css = fs.readFileSync(
    path.join(__dirname, '../src/renderer/src/assets/comments.css'),
    'utf8'
  )
  const desktopRailRule = css.match(/\.comments-margin-rail\s*\{[^}]*\}/)?.[0] || ''
  assert.equal(
    /margin-top\s*:/.test(desktopRailRule),
    false,
    'Desktop comments rail must not add margin-top when positioned at top: 0 of stage'
  )

  await mountEditor([
    {
      id: 't1',
      anchor: {
        quote: 'frase',
        prefix: 'Primera ',
        suffix: ' para comentar aquí.',
        fromOffset: 8,
        toOffset: 13
      },
      comments: [{ id: 'c1', body: 'Alineado', createdAt: 100, updatedAt: 100 }],
      createdAt: 100
    }
  ])

  const stage = document.querySelector('.editor-page-stage')
  stage.getBoundingClientRect = () => ({
    left: 0,
    right: 900,
    top: 40,
    bottom: 740,
    width: 900,
    height: 700
  })

  const mark = document.querySelector('[data-comment-id="t1"]')
  assert.ok(mark)
  mark.getClientRects = () => [
    { left: 80, right: 140, top: 160, bottom: 184, width: 60, height: 24 }
  ]

  await act(async () => {
    stage.dispatchEvent(new Event('transitionend'))
  })
  await settle(25)

  const bubble = document.querySelector('.comment-bubble')
  assert.ok(bubble)
  assert.equal(bubble.style.top, '110px')
})
