import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isSafeExternalUrl, isTrustedSender } from './ipcSecurity'
import { installContextMenu } from './spellcheck'

const rendererFile = join(__dirname, '../renderer/index.html')
const windowBackground = (dark) => (dark ? '#161814' : '#efeee8')

export function createWindowManager({ developmentUrl, icon, systemLanguage }) {
  const rendererUrl = developmentUrl || pathToFileURL(rendererFile).href
  const trustedWindows = new Set()
  const closeRequests = new Map()
  const closeReady = new Set()
  let quitting = false

  app.on('before-quit', () => {
    quitting = true
  })
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows().find(({ webContents }) =>
      trustedWindows.has(webContents)
    )
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  function registerIpc({ handle, on }) {
    handle('window:confirm-close', ({ sender }, approved) => {
      const close = closeRequests.get(sender)
      closeRequests.delete(sender)
      if (approved === true && close) close()
      else quitting = false
      return { success: true }
    })

    on('window:close-ready', ({ sender }, ready) => {
      if (ready === true) closeReady.add(sender)
      else closeReady.delete(sender)
    })

    on('window:set-theme', ({ sender }, mode) => {
      if (!['light', 'dark', 'system'].includes(mode)) return
      const window = BrowserWindow.fromWebContents(sender)
      if (!window) return
      nativeTheme.themeSource = mode
      window.setBackgroundColor(windowBackground(nativeTheme.shouldUseDarkColors))
    })

    handle('window:set-fullscreen', ({ sender }, flag) => {
      const window = BrowserWindow.fromWebContents(sender)
      if (!window) return false
      window.setFullScreen(Boolean(flag))
      return window.isFullScreen()
    })
    handle('window:toggle-fullscreen', ({ sender }) => {
      const window = BrowserWindow.fromWebContents(sender)
      if (!window) return false
      const nextState = !window.isFullScreen()
      window.setFullScreen(nextState)
      return nextState
    })
    handle('window:is-fullscreen', ({ sender }) =>
      Boolean(BrowserWindow.fromWebContents(sender)?.isFullScreen())
    )
  }

  function open({ getLanguage, onClosed }) {
    const window = new BrowserWindow({
      title: 'Inkwell',
      width: 1050,
      height: 720,
      minWidth: 700,
      minHeight: 500,
      show: false,
      backgroundColor: windowBackground(false),
      autoHideMenuBar: true,
      ...(process.platform === 'darwin' ? {} : { icon }),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        additionalArguments: [`--inkwell-system-language=${systemLanguage}`],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })

    const contents = window.webContents
    trustedWindows.add(contents)
    let closeApproved = false
    window.on('close', (event) => {
      if (closeApproved || !closeReady.has(contents)) return
      // Let the renderer flush pending document edits before closing the window.
      event.preventDefault()
      if (closeRequests.has(contents)) return
      closeRequests.set(contents, () => {
        closeApproved = true
        window.close()
        if (quitting) app.quit()
      })
      contents.send('window:request-close')
    })
    window.on('closed', () => {
      trustedWindows.delete(contents)
      closeReady.delete(contents)
      closeRequests.delete(contents)
      onClosed(contents)
    })
    if (process.platform === 'win32') window.setIcon(icon)

    window.on('ready-to-show', () => window.show())
    window.on('enter-full-screen', () => contents.send('window:fullscreen-changed', true))
    window.on('leave-full-screen', () => contents.send('window:fullscreen-changed', false))
    installContextMenu(window, getLanguage)

    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) shell.openExternal(url).catch(console.error)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event) => event.preventDefault())
    contents.on('will-attach-webview', (event) => event.preventDefault())

    if (developmentUrl) window.loadURL(developmentUrl)
    else window.loadFile(rendererFile)
  }

  return {
    isTrusted: (event) => isTrustedSender(event, trustedWindows, rendererUrl),
    registerIpc,
    open
  }
}
