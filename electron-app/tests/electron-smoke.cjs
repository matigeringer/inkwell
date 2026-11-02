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
  require('../out/main/index.js')
  const window = await created
  const evaluate = (code) => window.webContents.executeJavaScript(code)
  await waitFor(() => evaluate('Boolean(document.querySelector(".welcome-actions"))'))
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true)
  assert.equal(await evaluate('typeof window.electron'), 'undefined')
  assert.equal(await evaluate('typeof window.require'), 'undefined')
  assert.equal((await evaluate('window.api.openFolder()')).success, true)
  await evaluate('document.querySelectorAll(".welcome-actions button")[1].click()')
  await waitFor(() => evaluate('Boolean(document.querySelector(".tiptap"))'))
  await evaluate('document.querySelector(".tiptap").focus()')
  await window.webContents.insertText(' native edit')
  await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }))')
  await waitFor(async () => (await fs.readFile(source, 'utf8')).includes('native edit'))
  const pdf = await evaluate(
    `window.api.exportDocument(${JSON.stringify({ format: 'pdf', content: '# Safe export\n\n<script>throw new Error("must not execute")</script>' })})`
  )
  assert.equal(pdf.success, true, pdf.error)
  assert.equal(
    (await fs.readFile(path.join(directory, 'export.pdf'))).subarray(0, 5).toString(),
    '%PDF-'
  )
  console.log(
    'Electron smoke: sandbox, preload, native IPC, editing, transition save and PDF passed'
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
