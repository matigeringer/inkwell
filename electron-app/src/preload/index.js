import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  onRequestClose: (callback) => {
    const listener = () => {
      Promise.resolve()
        .then(callback)
        .then(
          (approved) => ipcRenderer.invoke('window:confirm-close', approved === true),
          () => ipcRenderer.invoke('window:confirm-close', false)
        )
        .catch((error) => console.warn('Close acknowledgement:', error.message))
    }
    ipcRenderer.on('window:request-close', listener)
    ipcRenderer.send('window:close-ready', true)
    return () => {
      ipcRenderer.removeListener('window:request-close', listener)
      ipcRenderer.send('window:close-ready', false)
    }
  },
  // Archivos
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  saveFileAs: (data) => ipcRenderer.invoke('file:save-as', data),
  exportPdf: (data) => ipcRenderer.invoke('file:export-pdf', data),
  exportDocument: (data) => ipcRenderer.invoke('file:export', data),
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  createFile: (data) => ipcRenderer.invoke('file:create', data),

  // Carpetas y Espacios de Trabajo
  openFolder: () => ipcRenderer.invoke('folder:open'),
  readFolderTree: (folderPath) => ipcRenderer.invoke('folder:read-tree', folderPath),
  createFolder: (data) => ipcRenderer.invoke('folder:create', data),
  searchFiles: (data) => ipcRenderer.invoke('workspace-search:start', data),
  cancelFileSearch: (id) => ipcRenderer.invoke('workspace-search:cancel', id),
  onFileSearchBatch: (callback) => {
    const listener = (_event, batch) => callback(batch)
    ipcRenderer.on('workspace-search:batch', listener)
    return () => ipcRenderer.removeListener('workspace-search:batch', listener)
  },

  // Operaciones comunes
  renameItem: (data) => ipcRenderer.invoke('item:rename', data),
  deleteItem: (targetPath) => ipcRenderer.invoke('item:delete', targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke('item:show-in-folder', targetPath),

  // Control de Pantalla Completa / Zen
  setWindowTheme: (mode) => ipcRenderer.send('window:set-theme', mode),
  setFullScreen: (flag) => ipcRenderer.invoke('window:set-fullscreen', flag),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullScreenChange: (callback) => {
    const subscription = (_event, isFullscreen) => callback(isFullscreen)
    ipcRenderer.on('window:fullscreen-changed', subscription)
    return () => ipcRenderer.removeListener('window:fullscreen-changed', subscription)
  },

  // Corrector Ortográfico e Idioma
  setSpellCheckerConfig: (config) => ipcRenderer.invoke('spellcheck:set-config', config),
  getSpellCheckerConfig: () => ipcRenderer.invoke('spellcheck:get-config'),
  setAppLanguage: (lang) => ipcRenderer.invoke('app:set-language', lang),

  // Historial Temporal de Versiones
  historyMove: (data) => ipcRenderer.invoke('history:move', data),
  historySaveSnapshot: (data) => ipcRenderer.invoke('history:save-snapshot', data),
  historyGetSnapshots: (docKey) => ipcRenderer.invoke('history:get-snapshots', docKey),
  historyGetSnapshotContent: (data) => ipcRenderer.invoke('history:get-snapshot-content', data),
  historyDeleteSnapshot: (data) => ipcRenderer.invoke('history:delete-snapshot', data),
  historyClear: (docKey) => ipcRenderer.invoke('history:clear', docKey),
  historyClearAll: () => ipcRenderer.invoke('history:clear-all'),
  historyPruneAll: (maxEntries) => ipcRenderer.invoke('history:prune-all', maxEntries)
}

contextBridge.exposeInMainWorld('api', api)
