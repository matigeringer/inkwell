import { app, shell, BrowserWindow, ipcMain, dialog, Menu, MenuItem, session } from 'electron'
import { join, basename, extname } from 'path'
import { promises as fs } from 'fs'
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
  pruneAllHistory
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

// Desactivar sandbox para entornos Linux con particiones montadas con nosuid
app.commandLine.appendSwitch('no-sandbox')

const IGNORED_NAMES = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  '.git',
  '.vscode',
  '.idea',
  '.system_generated',
  '$RECYCLE.BIN'
])
const VALID_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt'])

/**
 * Lee recursivamente el árbol de archivos y subcarpetas para el explorador
 */
async function buildDirectoryTree(dirPath, currentDepth = 0, maxDepth = 8) {
  if (currentDepth > maxDepth) return []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const children = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_NAMES.has(entry.name)) {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subChildren = await buildDirectoryTree(fullPath, currentDepth + 1, maxDepth)
        children.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children: subChildren
        })
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (VALID_EXTENSIONS.has(ext)) {
          children.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false
          })
        }
      }
    }

    // Ordenar: primero carpetas (a-z), luego archivos (a-z)
    return children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
  } catch (err) {
    console.error(`Error al leer directorio ${dirPath}:`, err)
    return []
  }
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
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? {} : { icon: appIcon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      spellcheck: true
    }
  })

  if (process.platform === 'win32') {
    mainWindow.setIcon(appIcon)
  }

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
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

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
app.whenReady().then(() => {
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
  ipcMain.handle('spellcheck:set-config', async (_event, { language, enabled } = {}) => {
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

  ipcMain.handle('spellcheck:get-config', async () => {
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

  ipcMain.handle('app:set-language', async (_event, lang) => {
    currentAppLanguage = lang === 'en' ? 'en' : 'es'
    applySpellCheckerLanguages(currentAppLanguage)
    return { success: true, currentAppLanguage }
  })

  // Manejadores IPC para Carpetas y Espacios de Trabajo
  ipcMain.handle('folder:open', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const isEn = currentAppLanguage === 'en'
      const result = await dialog.showOpenDialog(win, {
        title: isEn ? 'Open workspace folder' : 'Abrir carpeta de trabajo',
        properties: ['openDirectory', 'createDirectory']
      })

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true }
      }

      const folderPath = result.filePaths[0]
      const tree = await buildDirectoryTree(folderPath)
      return {
        success: true,
        folderPath,
        folderName: basename(folderPath),
        tree
      }
    } catch (error) {
      console.error('Error al abrir carpeta:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('folder:read-tree', async (_event, folderPath) => {
    try {
      if (!folderPath) return { success: false, error: 'Ruta no especificada' }
      const tree = await buildDirectoryTree(folderPath)
      return {
        success: true,
        folderPath,
        folderName: basename(folderPath),
        tree
      }
    } catch (error) {
      console.error('Error al leer árbol de carpeta:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('folder:create', async (_event, { parentPath, folderName } = {}) => {
    try {
      if (!parentPath || !folderName) {
        return { success: false, error: 'Faltan parámetros para crear la carpeta' }
      }
      const safeName = folderName.trim()
      const targetPath = join(parentPath, safeName)

      await fs.mkdir(targetPath, { recursive: true })
      return {
        success: true,
        folderPath: targetPath,
        folderName: safeName
      }
    } catch (error) {
      console.error('Error al crear carpeta:', error)
      return { success: false, error: error.message }
    }
  })

  // Manejadores IPC para Archivos individuales
  ipcMain.handle('file:open-dialog', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const isEn = currentAppLanguage === 'en'
      const result = await dialog.showOpenDialog(win, {
        title: isEn ? 'Open Markdown document' : 'Abrir documento Markdown',
        properties: ['openFile'],
        filters: [
          {
            name: isEn
              ? 'Markdown Documents (*.md, *.markdown, *.txt)'
              : 'Documentos Markdown (*.md, *.markdown, *.txt)',
            extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt']
          },
          { name: isEn ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true }
      }

      const filePath = result.filePaths[0]
      const content = await fs.readFile(filePath, 'utf-8')
      return {
        success: true,
        filePath,
        fileName: basename(filePath),
        content
      }
    } catch (error) {
      console.error('Error al abrir archivo:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('file:read', async (_event, filePath) => {
    try {
      if (!filePath) return { success: false, error: 'Ruta no especificada' }
      const content = await fs.readFile(filePath, 'utf-8')
      return {
        success: true,
        filePath,
        fileName: basename(filePath),
        content
      }
    } catch (error) {
      console.error('Error al leer archivo:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('file:create', async (_event, { parentPath, fileName, content = '' } = {}) => {
    try {
      if (!parentPath || !fileName) {
        return { success: false, error: 'Faltan parámetros para crear el archivo' }
      }

      let safeName = fileName.trim()
      if (!safeName.includes('.')) {
        safeName += '.md'
      }

      const targetPath = join(parentPath, safeName)

      try {
        await fs.access(targetPath)
        return { success: false, error: `Ya existe un elemento llamado "${safeName}"` }
      } catch {
        // No existe, continuamos
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      return {
        success: true,
        filePath: targetPath,
        fileName: safeName
      }
    } catch (error) {
      console.error('Error al crear archivo:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('file:save', async (event, { content, filePath, defaultName } = {}) => {
    try {
      let targetPath = filePath
      if (!targetPath) {
        const win = BrowserWindow.fromWebContents(event.sender)
        const isEn = currentAppLanguage === 'en'
        const defaultDocName = defaultName || (isEn ? 'document.md' : 'documento.md')
        const result = await dialog.showSaveDialog(win, {
          title: isEn ? 'Save Markdown document' : 'Guardar documento Markdown',
          defaultPath: defaultDocName,
          filters: [
            { name: isEn ? 'Markdown (*.md)' : 'Markdown (*.md)', extensions: ['md', 'markdown'] },
            { name: isEn ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }
        targetPath = result.filePath
      }

      await fs.writeFile(targetPath, content ?? '', 'utf-8')
      return {
        success: true,
        filePath: targetPath,
        fileName: basename(targetPath)
      }
    } catch (error) {
      console.error('Error al guardar archivo:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  ipcMain.handle('file:save-as', async (event, { content, defaultName } = {}) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const isEn = currentAppLanguage === 'en'
      const defaultDocName = defaultName || (isEn ? 'document.md' : 'documento.md')
      const result = await dialog.showSaveDialog(win, {
        title: isEn ? 'Save Markdown document as...' : 'Guardar documento Markdown como...',
        defaultPath: defaultDocName,
        filters: [
          { name: isEn ? 'Markdown (*.md)' : 'Markdown (*.md)', extensions: ['md', 'markdown'] },
          { name: isEn ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { canceled: true }
      }

      await fs.writeFile(result.filePath, content ?? '', 'utf-8')
      return {
        success: true,
        filePath: result.filePath,
        fileName: basename(result.filePath)
      }
    } catch (error) {
      console.error('Error al guardar archivo como:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  // Exportar documento de lectura a PDF o formatos múltiples
  ipcMain.handle('file:export-pdf', async (event, data) => {
    return exportDocumentToPdf(event, data, currentAppLanguage)
  })

  ipcMain.handle('file:export', async (event, data) => {
    return exportDocument(event, data, currentAppLanguage)
  })

  // Renombrar y Eliminar (comunes para archivos y carpetas)
  ipcMain.handle('item:rename', async (_event, { oldPath, newName } = {}) => {
    try {
      if (!oldPath || !newName) {
        return { success: false, error: 'Faltan parámetros para renombrar' }
      }

      const parentDir = join(oldPath, '..')
      const newPath = join(parentDir, newName.trim())

      await fs.rename(oldPath, newPath)
      return {
        success: true,
        oldPath,
        newPath,
        newName: basename(newPath)
      }
    } catch (error) {
      console.error('Error al renombrar elemento:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('item:delete', async (_event, targetPath) => {
    try {
      if (!targetPath) return { success: false, error: 'Ruta no especificada' }
      try {
        await shell.trashItem(targetPath)
      } catch {
        await fs.rm(targetPath, { recursive: true, force: true })
      }
      return { success: true, targetPath }
    } catch (error) {
      console.error('Error al eliminar elemento:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('item:show-in-folder', async (_event, targetPath) => {
    try {
      if (targetPath) {
        shell.showItemInFolder(targetPath)
        return { success: true }
      }
      return { success: false }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Manejadores IPC para control de Pantalla Completa (Modo Zen)
  ipcMain.handle('window:set-fullscreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(Boolean(flag))
      return win.isFullScreen()
    }
    return false
  })

  ipcMain.handle('window:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const nextState = !win.isFullScreen()
      win.setFullScreen(nextState)
      return nextState
    }
    return false
  })

  ipcMain.handle('window:is-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })

  // Manejadores IPC para Historial Temporal de Versiones
  ipcMain.handle('history:save-snapshot', async (_event, data) => {
    return saveSnapshot(data)
  })

  ipcMain.handle('history:get-snapshots', async (_event, docKey) => {
    return getSnapshots(docKey)
  })

  ipcMain.handle('history:get-snapshot-content', async (_event, data) => {
    return getSnapshotContent(data)
  })

  ipcMain.handle('history:delete-snapshot', async (_event, data) => {
    return deleteSnapshot(data)
  })

  ipcMain.handle('history:clear', async (_event, docKey) => {
    return clearDocHistory(docKey)
  })

  ipcMain.handle('history:clear-all', async () => {
    return clearAllHistory()
  })

  ipcMain.handle('history:prune-all', async (_event, maxEntries) => {
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
