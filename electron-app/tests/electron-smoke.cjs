// Run with Electron, not Node. It uses a disposable profile and native Chromium.
const { app, BrowserWindow, dialog } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

let directory
const deadline = setTimeout(() => {
  console.error('Electron smoke test timed out')
  app.exit(1)
}, 45000)

const waitFor = async (condition) => {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Timed out waiting for the renderer')
}

;(async () => {
  directory = await fs.mkdtemp('/tmp/inkwell-native-')
  app.setPath('appData', directory)
  const workspace = path.join(directory, 'workspace')
  await fs.mkdir(workspace)
  const source = path.join(workspace, 'manuscript.md')
  await fs.writeFile(source, '# Native test\n\noriginal manuscript')
  const other = path.join(workspace, 'chapter.md')
  await fs.writeFile(other, '# Other chapter\n\nUna bri**sa** ligera.')
  await fs.writeFile(
    path.join(workspace, 'notes.txt'),
    `${'Otra línea.\n'.repeat(100)}BRISA final.`
  )
  dialog.showOpenDialog = async (_window, options) => ({
    canceled: false,
    filePaths: [options.properties.includes('openDirectory') ? workspace : source]
  })
  dialog.showSaveDialog = async (_window, options) => ({
    canceled: false,
    filePath: path.join(directory, `export.${options.filters[0].extensions[0]}`)
  })
  const created = new Promise((resolve) =>
    app.once('browser-window-created', (_event, window) => {
      window.webContents.once('did-finish-load', () => resolve(window))
    })
  )
  const entry = process.argv.includes('--packaged')
    ? '../dist/linux-unpacked/resources/app.asar/out/main/index.js'
    : '../out/main/index.js'
  require(entry)
  const window = await created
  const evaluate = (code) => window.webContents.executeJavaScript(code)
  const key = (key, modifiers = {}) =>
    evaluate(
      `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key, bubbles: true, cancelable: true, ...modifiers })}))`
    )
  const openFileSearch = () => key('f', { ctrlKey: true, altKey: true })
  const fileQuery = async (query) => {
    await evaluate(
      '(() => { const input = document.querySelector(".workspace-search input[type=search]"); input.focus(); input.select() })()'
    )
    await window.webContents.insertText(query)
  }
  await waitFor(() => evaluate('Boolean(document.querySelector(".welcome-actions"))'))
  const [primaryLanguage = ''] = app.getPreferredSystemLanguages()
  const expectedLanguage = primaryLanguage.toLowerCase().split(/[-_.@]/)[0] === 'es' ? 'es' : 'en'
  await waitFor(() => evaluate(`document.documentElement.lang === '${expectedLanguage}'`))
  assert.equal(
    (await evaluate('window.api.getSpellCheckerConfig()')).currentAppLanguage,
    expectedLanguage
  )
  await evaluate(
    'localStorage.setItem("fountain_preferences", JSON.stringify({ version: 1, language: "es", autoSaveEnabled: false }))'
  )
  const reloaded = new Promise((resolve) => window.webContents.once('did-finish-load', resolve))
  window.webContents.reload()
  await reloaded
  await waitFor(() => evaluate('Boolean(document.querySelector(".welcome-actions"))'))
  await waitFor(() => evaluate('document.documentElement.lang === "es"'))
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true)
  assert.equal(await evaluate('typeof window.electron'), 'undefined')
  assert.equal(await evaluate('typeof window.require'), 'undefined')
  assert.equal((await evaluate('window.api.openFolder()')).success, true)
  await evaluate('document.querySelectorAll(".welcome-actions button")[2].click()')
  await waitFor(() =>
    evaluate('Boolean(document.querySelector(".manuscripts-zone .file-tree-container"))')
  )
  await evaluate('document.querySelectorAll(".welcome-actions button")[1].click()')
  await waitFor(() => evaluate('Boolean(document.querySelector(".tiptap"))'))
  await evaluate('document.querySelector(".tiptap").focus()')
  await window.webContents.insertText(' native edit')
  await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }))')
  await waitFor(async () => (await fs.readFile(source, 'utf8')).includes('native edit'))
  await waitFor(() =>
    evaluate('document.querySelector(".doc-title-text")?.textContent === "documento.md"')
  )
  await key('o', { ctrlKey: true })
  await waitFor(() =>
    evaluate('document.querySelector(".tiptap")?.textContent.includes("native edit")')
  )

  window.setSize(700, 500)
  await openFileSearch()
  await waitFor(() => evaluate('document.activeElement.closest(".workspace-search") !== null'))
  await key('f', { ctrlKey: true })
  assert.ok(
    await evaluate(`(() => {
    const left = document.querySelector('.workspace-search').getBoundingClientRect()
    const right = document.querySelector('.manuscript-search').getBoundingClientRect()
    return left.right <= right.left && right.right <= innerWidth
  })()`)
  )
  await key('Escape')
  assert.ok(
    await evaluate(
      '!document.querySelector(".manuscript-search") && Boolean(document.querySelector(".workspace-search"))'
    )
  )
  await evaluate('document.querySelector(".tiptap").focus()')
  await window.webContents.insertText(' borrador vivo')
  await fileQuery('borrador vivo')
  await waitFor(() =>
    evaluate(
      'document.querySelector(".workspace-search-hit mark")?.textContent === "borrador vivo"'
    )
  )
  await evaluate('document.querySelector(".workspace-search-hit").click()')
  await waitFor(() =>
    evaluate(
      'window.getSelection().isCollapsed && document.querySelector(".workspace-search-hit[aria-current=true] mark")?.textContent === "borrador vivo" && document.querySelector(".tiptap .workspace-editor-match")?.textContent === "borrador vivo"'
    )
  )
  await evaluate('document.querySelector(".workspace-search input[type=search]").focus()')
  assert.ok(await evaluate('Boolean(document.querySelector(".tiptap .workspace-editor-match"))'))

  await key('F11')
  await waitFor(() => evaluate('Boolean(document.querySelector(".zen-mode-active"))'))
  await fileQuery('brisa')
  await waitFor(() => evaluate('document.querySelectorAll(".workspace-search-hit").length === 2'))
  assert.ok(await evaluate('!document.querySelector(".tiptap .workspace-editor-match")'))
  const saved = await fs.readFile(source)
  await fs.writeFile(source, 'external change')
  await evaluate('document.querySelector(".workspace-search-hit").click()')
  await waitFor(() => evaluate('Boolean(document.querySelector(".zen-toast-error"))'))
  assert.ok(
    await evaluate(
      'document.querySelector(".tiptap").textContent.includes("borrador vivo") && Boolean(document.querySelector(".workspace-search"))'
    )
  )
  await fs.writeFile(source, saved)
  await evaluate('document.querySelector(".workspace-search-hit").click()')
  await waitFor(() =>
    evaluate('document.querySelector(".doc-title-text")?.textContent === "chapter.md"')
  )
  await waitFor(() =>
    evaluate(`window.getSelection().isCollapsed &&
      [...document.querySelectorAll('.tiptap .workspace-editor-match')].map((part) => part.textContent).join('') === 'brisa' &&
      document.querySelector('.workspace-search-count')?.textContent === '1 de 2'`)
  )
  assert.ok(await evaluate('Boolean(document.querySelector(".zen-mode-active"))'))
  // The previous arrow wraps from the first result to the last file.
  await evaluate('document.querySelector(".workspace-search-actions button:first-child").click()')
  await waitFor(() =>
    evaluate(`(() => {
    const textarea = document.querySelector('textarea.fountain-source-editor')
    return textarea && textarea.selectionStart === textarea.value.indexOf('BRISA') &&
      textarea.selectionStart === textarea.selectionEnd &&
      textarea.scrollTop > 1000 && document.querySelector('.workspace-search-hit[aria-current=true] mark')?.textContent === 'BRISA' &&
      document.querySelector('.source-search-overlay .workspace-editor-match')?.textContent === 'BRISA' &&
      document.querySelector('.workspace-search-count')?.textContent === '2 de 2'
  })()`)
  )
  assert.ok(
    await evaluate(`(() => {
    const match = document.querySelector('.source-search-overlay .workspace-editor-match')
    const activeResult = document.querySelector('.workspace-search-hit[aria-current=true] mark')
    const otherResult = document.querySelector('.workspace-search-hit:not([aria-current]) mark')
    return getComputedStyle(match).backgroundColor === getComputedStyle(activeResult).backgroundColor &&
      getComputedStyle(match).backgroundColor !== getComputedStyle(otherResult).backgroundColor
  })()`)
  )
  await key('f', { ctrlKey: true })
  await waitFor(() => evaluate('document.activeElement.matches(".manuscript-search input")'))
  await window.webContents.insertText('RIS')
  await waitFor(() =>
    evaluate(`document.querySelector('.manuscript-search-count')?.textContent === '1 de 1' &&
      document.querySelector('.source-search-overlay .workspace-editor-match')?.textContent === 'BRISA'`)
  )
  await key('Escape')
  await evaluate('document.querySelector(".workspace-search-hit[aria-current=true]").click()')
  assert.ok(
    await evaluate(
      'Boolean(document.querySelector(".zen-mode-active .workspace-search .workspace-search-hit[aria-current=true]"))'
    )
  )
  await key('Escape')
  await waitFor(() =>
    evaluate(
      'Boolean(document.querySelector(".zen-mode-active")) && !document.querySelector(".workspace-search, .workspace-editor-match")'
    )
  )
  await key('Escape')
  const pdf = await evaluate(
    `window.api.exportDocument(${JSON.stringify({ format: 'pdf', content: '# Safe export\n\n<script>throw new Error("must not execute")</script>' })})`
  )
  assert.equal(pdf.success, true, pdf.error)
  assert.equal(
    (await fs.readFile(path.join(directory, 'export.pdf'))).subarray(0, 5).toString(),
    '%PDF-'
  )
  console.log(
    'Electron smoke: sandbox, preload, native IPC, editing, transition save, workspace search and PDF passed'
  )
  clearTimeout(deadline)
  app.once('will-quit', () => {
    fs.rm(directory, { recursive: true, force: true }).catch(console.error)
  })
  window.close()
  await waitFor(() => BrowserWindow.getAllWindows().length === 0)
  app.quit()
})().catch((error) => {
  console.error(error)
  clearTimeout(deadline)
  app.exit(1)
})
