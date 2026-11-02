const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const load = require('./load.cjs')
const { isTrustedSender, isSafeExternalUrl } = load('src/main/ipcSecurity.js')

test('IPC accepts only the exact trusted window, top-level frame and document URL', () => {
  const frame = { url: 'file:///app/index.html' }
  const sender = { mainFrame: frame }
  const windows = new Set([sender])
  assert.equal(isTrustedSender({ sender, senderFrame: frame }, windows, frame.url), true)
  assert.equal(isTrustedSender({ sender, senderFrame: { ...frame } }, windows, frame.url), false)
  assert.equal(
    isTrustedSender({ sender: { mainFrame: frame }, senderFrame: frame }, windows, frame.url),
    false
  )
  assert.equal(
    isTrustedSender({ sender, senderFrame: frame }, windows, 'https://attacker.invalid/'),
    false
  )
})

test('external URI allowlist rejects executable, file, data and malformed URLs', () => {
  for (const url of [
    'file:///tmp/program',
    'javascript:alert(1)',
    'data:text/html,bad',
    'shell:evil',
    'https://user:password@example.org',
    'not a url'
  ])
    assert.equal(isSafeExternalUrl(url), false)
  assert.equal(isSafeExternalUrl('https://example.org'), true)
  assert.equal(isSafeExternalUrl('mailto:author@example.org'), true)
})

test('PDF export ignores supplied HTML and disables scripts, network, popups and permissions', async (t) => {
  const root = await fs.mkdtemp('/tmp/inkwell-export-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  let window
  class PrintWindow {
    constructor(options) {
      window = this
      this.options = options
      this.events = {}
      this.webContents = {
        setWindowOpenHandler: (handler) => {
          this.open = handler
        },
        on: (name, handler) => {
          this.events[name] = handler
        },
        session: {
          setPermissionRequestHandler: (handler) => {
            this.permission = handler
          },
          setPermissionCheckHandler: (handler) => {
            this.permissionCheck = handler
          },
          webRequest: {
            onBeforeRequest: (handler) => {
              this.request = handler
            }
          }
        },
        printToPDF: async () => Buffer.from('%PDF-test')
      }
    }
    static fromWebContents() {
      return {}
    }
    async loadURL(url) {
      this.html = decodeURIComponent(url.slice(url.indexOf(',') + 1))
    }
    isDestroyed() {
      return false
    }
    destroy() {
      this.destroyed = true
    }
  }
  const electron = {
    BrowserWindow: PrintWindow,
    dialog: { showSaveDialog: async () => ({ filePath: path.join(root, 'export.pdf') }) }
  }
  const { exportDocumentToPdf } = load('src/main/pdfExporter.js', { electron })
  const result = await exportDocumentToPdf(
    { sender: {} },
    { content: '<script>alert(1)</script>', htmlContent: '<script>untrusted()</script>' }
  )
  assert.equal(result.success, true)
  assert.equal(window.options.webPreferences.sandbox, true)
  assert.equal(window.options.webPreferences.javascript, false)
  assert.ok(!window.html.includes('<script>'))
  assert.match(window.html, /script-src 'none'/)
  assert.equal(window.open().action, 'deny')
  let canceled
  window.request({ url: 'https://example.org/tracker' }, ({ cancel }) => {
    canceled = cancel
  })
  assert.equal(canceled, true)
  assert.equal(window.permissionCheck(), false)
  assert.equal(window.destroyed, true)
})

test('explicitly empty export never reloads old disk content', async (t) => {
  const root = await fs.mkdtemp('/tmp/inkwell-empty-export-')
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const input = path.join(root, 'input.md')
  const output = path.join(root, 'empty.md')
  await fs.writeFile(input, 'old content')
  const { exportDocument } = load('src/main/documentExporter.js', {
    electron: {
      BrowserWindow: { fromWebContents: () => ({}) },
      dialog: { showSaveDialog: async () => ({ filePath: output }) }
    }
  })
  assert.equal(
    (await exportDocument({ sender: {} }, { format: 'markdown', content: '', filePath: input }))
      .success,
    true
  )
  assert.equal(await fs.readFile(output, 'utf8'), '')
})
