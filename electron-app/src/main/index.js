import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  MenuItem,
  session,
  nativeTheme
} from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'node:url'
import { FileService, validateContent, validateName } from './fileService'
import { isTrustedSender, isSafeExternalUrl } from './ipcSecurity'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'

const appIcon = process.platform === 'win32' ? iconIco : icon
import { exportDocumentToPdf } from './pdfExporter'
import { exportDocument } from './documentExporter'
import {
  saveSnapshot,
  getSnapshots,
  getSnapshotContent,
  deleteSnapshot,
  clearDocHistory,
  clearAllHistory,
  pruneAllHistory,
  moveDocHistory,
  moveHistoryPaths
} from './historyManager'

// Idioma activo de la aplicación ('es' | 'en') y soporte de corrección ortográfica
let currentAppLanguage = 'es'

function applySpellCheckerLanguages(lang) {
  try {
    const spellLangs = lang === 'en' ? ['en-US', 'en'] : ['es-ES', 'es']
    session.defaultSession.setSpellCheckerLanguages(spellLangs)
  } catch (err) {
    console.error('Error al configurar idiomas de corrección ortográfica:', err)
  }
}

// Conservar los datos existentes al separar el nombre visible del identificador npm.
app.setPath('userData', join(app.getPath('appData'), 'inkwell'))

// Only one process owns the document queues and conflict baselines.
if (!app.requestSingleInstanceLock()) app.exit(0)

const trustedWindows = new Set()
const closeRequests = new Map()
const closeReady = new Set()
const rendererUrl =
  is.dev && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).href
let fileService
let quitting = false
app.on('before-quit', () => {
  quitting = true
})
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows().find((window) => trustedWindows.has(window.webContents))
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

function trusted(event) {
  return isTrustedSender(event, trustedWindows, rendererUrl)
}

function handle(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!trusted(event)) throw new Error('Remitente IPC no autorizado')
      return await listener(event, ...args)
    } catch (error) {
      console.error(`${channel}:`, error.message)
      return { success: false, error: error.message }
    }
  })
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    title: 'Inkwell',
    width: 1050,
    height: 720,
    minWidth: 700,
    minHeight: 500,
    show: false,
    backgroundColor: '#efeee8',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? {} : { icon: appIcon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  const contents = mainWindow.webContents
  trustedWindows.add(contents)
  let closeApproved = false
  mainWindow.on('close', (event) => {
    if (closeApproved || !closeReady.has(contents)) return
    event.preventDefault()
    if (closeRequests.has(mainWindow.webContents)) return
    closeRequests.set(mainWindow.webContents, () => {
      closeApproved = true
      mainWindow.close()
      if (quitting) app.quit()
    })
    mainWindow.webContents.send('window:request-close')
  })
  mainWindow.on('closed', () => {
    trustedWindows.delete(contents)
    closeReady.delete(contents)
    closeRequests.delete(contents)
  })
  if (process.platform === 'win32') mainWindow.setIcon(appIcon)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Menú contextual nativo con corrección ortográfica y portapapeles
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()
    const isEn = currentAppLanguage === 'en'

    // Si hay una palabra mal escrita detectada por el corrector ortográfico
    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(
            new MenuItem({
              label: suggestion,
              click: () => mainWindow.webContents.replaceMisspelling(suggestion)
            })
          )
        }
      } else {
        menu.append(
          new MenuItem({
            label: isEn ? 'No spelling suggestions' : 'Sin sugerencias ortográficas',
            enabled: false
          })
        )
      }

      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: isEn
            ? `Add "${params.misspelledWord}" to dictionary`
            : `Agregar "${params.misspelledWord}" al diccionario`,
          click: () =>
            mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo', label: isEn ? 'Undo' : 'Deshacer' }))
      menu.append(new MenuItem({ role: 'redo', label: isEn ? 'Redo' : 'Rehacer' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          role: 'cut',
          label: isEn ? 'Cut' : 'Cortar',
          enabled: Boolean(params.editFlags?.canCut)
        })
      )
      menu.append(
        new MenuItem({
          role: 'copy',
          label: isEn ? 'Copy' : 'Copiar',
          enabled: Boolean(params.editFlags?.canCopy)
        })
      )
      menu.append(
        new MenuItem({
          role: 'paste',
          label: isEn ? 'Paste' : 'Pegar',
          enabled: Boolean(params.editFlags?.canPaste)
        })
      )
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          role: 'selectAll',
          label: isEn ? 'Select All' : 'Seleccionar todo'
        })
      )
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menu.append(new MenuItem({ role: 'copy', label: isEn ? 'Copy' : 'Copiar' }))
      menu.append(
        new MenuItem({
          role: 'selectAll',
          label: isEn ? 'Select All' : 'Seleccionar todo'
        })
      )
    }

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow })
    }
  })

  // Sincronizar estado de pantalla completa con el renderer
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', true)
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window:fullscreen-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url).catch(console.error)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  fileService = new FileService(join(app.getPath('userData'), 'authorized-paths.json'), (path) =>
    shell.trashItem(path)
  )
  await fileService.initialize()
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.inkwell.app')
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Inicializar corrector ortográfico con el idioma activo
  applySpellCheckerLanguages(currentAppLanguage)

  // Manejadores IPC para Corrector Ortográfico e Idioma
  handle('spellcheck:set-config', async (_event, { language, enabled } = {}) => {
    try {
      if (language) {
        currentAppLanguage = language === 'en' ? 'en' : 'es'
        applySpellCheckerLanguages(currentAppLanguage)
      }
      if (typeof enabled === 'boolean') {
        session.defaultSession.setSpellCheckerEnabled(enabled)
      }
      return {
        success: true,
        currentAppLanguage,
        languages: session.defaultSession.getSpellCheckerLanguages(),
        enabled: session.defaultSession.isSpellCheckerEnabled()
      }
    } catch (error) {
      console.error('Error al configurar corrector ortográfico:', error)
      return { success: false, error: error.message }
    }
  })

  handle('spellcheck:get-config', async () => {
    try {
      return {
        success: true,
        currentAppLanguage,
        languages: session.defaultSession.getSpellCheckerLanguages(),
        available: session.defaultSession.getAvailableSpellCheckerLanguages(),
        enabled: session.defaultSession.isSpellCheckerEnabled()
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  handle('app:set-language', async (_event, lang) => {
    currentAppLanguage = lang === 'en' ? 'en' : 'es'
    applySpellCheckerLanguages(currentAppLanguage)
    return { success: true, currentAppLanguage }
  })

  handle('folder:open', async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: currentAppLanguage === 'en' ? 'Open workspace folder' : 'Abrir carpeta de trabajo',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }
    const folderPath = await fileService.grantDirectory(result.filePaths[0])
    return fileService.readTree(folderPath)
  })
  handle('folder:read-tree', (_event, path) => fileService.readTree(path))
  handle('folder:create', (_event, { parentPath, folderName } = {}) =>
    fileService.create(parentPath, folderName, true)
  )
  handle('file:open-dialog', async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: currentAppLanguage === 'en' ? 'Open document' : 'Abrir documento',
      properties: ['openFile'],
      filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }]
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }
    return fileService.readFile(await fileService.grantFile(result.filePaths[0]))
  })
  handle('file:read', (_event, path) => fileService.readFile(path))
  handle('file:create', (_event, { parentPath, fileName, content = '' } = {}) =>
    fileService.create(parentPath, fileName, false, content)
  )

  const saveWithDialog = async (event, { content, defaultName } = {}) => {
    validateContent(content)
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: currentAppLanguage === 'en' ? 'Save document' : 'Guardar documento',
      defaultPath: validateName(defaultName || 'documento.md'),
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    const target = await fileService.grantFile(result.filePath)
    return fileService.saveFile(target, content, { selected: true })
  }
  handle('file:save', (event, data = {}) =>
    data.filePath ? fileService.saveFile(data.filePath, data.content) : saveWithDialog(event, data)
  )
  handle('file:save-as', saveWithDialog)

  const prepareExport = async (data) => {
    if (!data || typeof data !== 'object') throw new Error('Exportación inválida')
    const prepared = { ...data }
    if (prepared.filePath) await fileService.authorize(prepared.filePath)
    if (prepared.content == null && prepared.filePath) {
      prepared.content = (
        await fileService.readFile(prepared.filePath, { remember: false })
      ).content
    }
    validateContent(prepared.content ?? '')
    // Export from Markdown only: never execute HTML supplied by a renderer.
    delete prepared.htmlContent
    return prepared
  }
  handle('file:export-pdf', async (event, data) =>
    exportDocumentToPdf(event, await prepareExport(data), currentAppLanguage)
  )
  handle('file:export', async (event, data) =>
    exportDocument(event, await prepareExport(data), currentAppLanguage)
  )
  handle('item:rename', async (_event, { oldPath, newName } = {}) => {
    const result = await fileService.rename(oldPath, newName)
    try {
      const history = await moveHistoryPaths(result.oldPath, result.newPath)
      if (!history.success) result.warning = history.error
    } catch (error) {
      result.warning = error.message
    }
    return result
  })
  handle('item:delete', (_event, targetPath) => fileService.delete(targetPath))
  handle('item:show-in-folder', async (_event, path) => {
    shell.showItemInFolder(await fileService.authorize(path))
    return { success: true }
  })
  handle('window:confirm-close', (event, approved) => {
    const close = closeRequests.get(event.sender)
    closeRequests.delete(event.sender)
    if (approved === true && close) close()
    else quitting = false
    return { success: true }
  })

  ipcMain.on('window:close-ready', (event, ready) => {
    if (!trusted(event)) return
    if (ready === true) closeReady.add(event.sender)
    else closeReady.delete(event.sender)
  })

  // Mantener el fondo y las decoraciones nativas en el mismo tema que el contenido.
  ipcMain.on('window:set-theme', (event, mode) => {
    if (!trusted(event)) return
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    nativeTheme.themeSource = mode
    win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#161814' : '#efeee8')
  })

  // Manejadores IPC para control de Pantalla Completa (Modo Zen)
  handle('window:set-fullscreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(Boolean(flag))
      return win.isFullScreen()
    }
    return false
  })

  handle('window:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const nextState = !win.isFullScreen()
      win.setFullScreen(nextState)
      return nextState
    }
    return false
  })

  handle('window:is-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })

  // Manejadores IPC para Historial Temporal de Versiones
  handle('history:move', (_event, data) => moveDocHistory(data))
  handle('history:save-snapshot', async (_event, data) => {
    return saveSnapshot(data)
  })

  handle('history:get-snapshots', async (_event, docKey) => {
    return getSnapshots(docKey)
  })

  handle('history:get-snapshot-content', async (_event, data) => {
    return getSnapshotContent(data)
  })

  handle('history:delete-snapshot', async (_event, data) => {
    return deleteSnapshot(data)
  })

  handle('history:clear', async (_event, docKey) => {
    return clearDocHistory(docKey)
  })

  handle('history:clear-all', async () => {
    return clearAllHistory()
  })

  handle('history:prune-all', async (_event, maxEntries) => {
    return pruneAllHistory(maxEntries)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
