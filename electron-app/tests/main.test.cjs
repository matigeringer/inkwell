const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { EventEmitter } = require('node:events')
const load = require('./load.cjs')

test('main enforces IPC grants and the close handshake with sandbox enabled', async (t) => {
  const directory = await fs.mkdtemp('/tmp/inkwell-main-')
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const selected = path.join(directory, 'selected.md')
  const privateFile = path.join(directory, 'private.md')
  const exportFile = path.join(directory, 'export.md')
  await fs.writeFile(selected, 'chosen by user')
  await fs.writeFile(privateFile, 'private')
  let exportDialogs = 0
  let ready
  const handlers = new Map()
  const ipcMain = new EventEmitter()
  ipcMain.handle = (name, handler) => handlers.set(name, handler)
  const app = new EventEmitter()
  Object.assign(app, {
    requestSingleInstanceLock: () => true,
    setPath() {},
    getPath: () => directory,
    whenReady: () => ({
      then: (callback) => {
        ready = callback()
      }
    }),
    quit() {},
    commandLine: { appendSwitch: () => assert.fail('Sandbox must not be disabled') }
  })
  const windows = []
  class Window extends EventEmitter {
    constructor(options) {
      super()
      this.options = options
      this.sent = []
      windows.push(this)
      this.webContents = new EventEmitter()
      Object.assign(this.webContents, {
        mainFrame: { url: '' },
        send: (...args) => this.sent.push(args),
        setWindowOpenHandler() {}
      })
    }
    loadFile(file) {
      this.webContents.mainFrame.url = pathToFileURL(file).href
    }
    show() {}
    isMinimized() {
      return false
    }
    focus() {}
    close() {
      const event = {
        prevented: false,
        preventDefault() {
          this.prevented = true
        }
      }
      this.emit('close', event)
      if (!event.prevented) {
        this.closed = true
        this.emit('closed')
      }
      return event
    }
    static fromWebContents(contents) {
      return windows.find((window) => window.webContents === contents)
    }
    static getAllWindows() {
      return windows
    }
  }
  load('src/main/index.js', {
    electron: {
      app,
      BrowserWindow: Window,
      ipcMain,
      shell: {},
      Menu: class {},
      MenuItem: class {},
      nativeTheme: {},
      session: {
        defaultSession: {
          setSpellCheckerLanguages() {},
          setPermissionRequestHandler() {},
          setPermissionCheckHandler() {}
        }
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: false, filePaths: [selected] }),
        showSaveDialog: async () => {
          exportDialogs++
          return { canceled: false, filePath: exportFile }
        }
      }
    },
    '@electron-toolkit/utils': {
      electronApp: { setAppUserModelId() {} },
      optimizer: {},
      is: { dev: false }
    }
  })
  await ready
  const window = windows[0]
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  assert.equal(window.options.webPreferences.sandbox, true)
  assert.equal(window.options.webPreferences.contextIsolation, true)
  assert.equal((await handlers.get('file:read')(event, privateFile)).success, false)
  assert.equal((await handlers.get('file:open-dialog')(event)).success, true)
  assert.equal((await handlers.get('file:read')(event, selected)).content, 'chosen by user')
  const untrusted = { ...event, senderFrame: { url: event.senderFrame.url } }
  assert.equal((await handlers.get('file:read')(untrusted, selected)).success, false)
  assert.equal(
    (
      await handlers.get('file:export')(event, {
        filePath: privateFile,
        format: 'markdown',
        content: 'supplied by renderer'
      })
    ).success,
    false
  )
  assert.equal(exportDialogs, 0)

  await fs.writeFile(selected, 'external edit')
  assert.equal(
    (await handlers.get('file:export')(event, { filePath: selected, format: 'markdown' })).success,
    true
  )
  assert.equal(await fs.readFile(exportFile, 'utf8'), 'external edit')
  const save = await handlers.get('file:save')(event, {
    filePath: selected,
    content: 'unsaved edit'
  })
  assert.equal(save.success, false)
  assert.equal(await fs.readFile(selected, 'utf8'), 'external edit')

  ipcMain.emit('window:close-ready', event, true)
  ipcMain.emit('window:close-ready', untrusted, false)
  assert.equal(window.close().prevented, true)
  assert.equal(window.sent.at(-1)[0], 'window:request-close')
  assert.equal((await handlers.get('window:confirm-close')(untrusted, true)).success, false)
  assert.equal(window.closed, undefined)
  await handlers.get('window:confirm-close')(event, false)
  assert.equal(window.closed, undefined)
  window.close()
  await handlers.get('window:confirm-close')(event, true)
  assert.equal(window.closed, true)
})
