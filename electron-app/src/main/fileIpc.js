import { BrowserWindow, dialog, shell } from 'electron'
import { validateContent, validateName } from './fileService'
import { exportDocument } from './documentExporter'
import { exportDocumentToPdf } from './pdfExporter'
import {
  clearAllHistory,
  clearDocHistory,
  deleteSnapshot,
  getSnapshotContent,
  getSnapshots,
  moveDocHistory,
  moveHistoryPaths,
  pruneAllHistory,
  saveSnapshot
} from './historyManager'

export function registerFileIpc({ handle }, fileService, getLanguage) {
  const title = (english, spanish) => (getLanguage() === 'en' ? english : spanish)

  handle('folder:open', async ({ sender }) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(sender), {
      title: title('Open workspace folder', 'Abrir carpeta de trabajo'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }
    return fileService.readTree(await fileService.grantDirectory(result.filePaths[0]))
  })
  handle('folder:read-tree', (_event, path) => fileService.readTree(path))
  handle('folder:create', (_event, { parentPath, folderName } = {}) =>
    fileService.create(parentPath, folderName, true)
  )

  handle('file:open-dialog', async ({ sender }) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(sender), {
      title: title('Open document', 'Abrir documento'),
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

  const saveWithDialog = async ({ sender }, { content, defaultName } = {}) => {
    validateContent(content)
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(sender), {
      title: title('Save document', 'Guardar documento'),
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
    const { filePath, fileName, format, title } = data
    let { content } = data
    if (filePath) {
      if (content == null)
        content = (await fileService.readFile(filePath, { remember: false })).content
      else await fileService.authorize(filePath)
    }
    return { filePath, fileName, format, title, content }
  }
  handle('file:export-pdf', async (event, data) =>
    exportDocumentToPdf(event, await prepareExport(data), getLanguage())
  )
  handle('file:export', async (event, data) =>
    exportDocument(event, await prepareExport(data), getLanguage())
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
  handle('item:delete', (_event, path) => fileService.delete(path))
  handle('item:show-in-folder', async (_event, path) => {
    shell.showItemInFolder(await fileService.authorize(path))
    return { success: true }
  })
}

export function registerHistoryIpc({ handle }) {
  handle('history:move', (_event, data) => moveDocHistory(data))
  handle('history:save-snapshot', (_event, data) => saveSnapshot(data))
  handle('history:get-snapshots', (_event, docKey) => getSnapshots(docKey))
  handle('history:get-snapshot-content', (_event, data) => getSnapshotContent(data))
  handle('history:delete-snapshot', (_event, data) => deleteSnapshot(data))
  handle('history:clear', (_event, docKey) => clearDocHistory(docKey))
  handle('history:clear-all', () => clearAllHistory())
  handle('history:prune-all', (_event, maxEntries) => pruneAllHistory(maxEntries))
}
