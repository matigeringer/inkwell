import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'
import { FileService } from './fileService'
import { createTrustedIpc } from './ipc'
import { registerFileIpc, registerHistoryIpc } from './fileIpc'
import { registerSpellcheckIpc } from './spellcheck'
import { createWindowManager } from './windowManager'
import { registerWorkspaceSearchIpc } from './workspaceSearchIpc'

async function initialize() {
  const fileService = new FileService(
    join(app.getPath('userData'), 'authorized-paths.json'),
    (path) => shell.trashItem(path)
  )
  await fileService.initialize()

  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
  electronApp.setAppUserModelId('com.inkwell.app')
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(icon)
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const windows = createWindowManager({
    developmentUrl: is.dev ? process.env.ELECTRON_RENDERER_URL : undefined,
    icon: process.platform === 'win32' ? iconIco : icon
  })
  const ipc = createTrustedIpc(windows.isTrusted)
  const getLanguage = registerSpellcheckIpc(ipc)
  registerFileIpc(ipc, fileService, getLanguage)
  registerHistoryIpc(ipc)
  const cancelSearch = registerWorkspaceSearchIpc(ipc, fileService)
  windows.registerIpc(ipc)

  const openWindow = () => windows.open({ getLanguage, onClosed: cancelSearch })
  openWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
}

// Keep the existing profile path across changes to the product and package names.
app.setPath('userData', join(app.getPath('appData'), 'inkwell'))

// A single process owns the document queues and conflict baselines.
if (app.requestSingleInstanceLock()) {
  app.whenReady().then(initialize)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
} else {
  app.exit(0)
}
