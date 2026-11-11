import { contextBridge, ipcRenderer } from 'electron'

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  onRequestClose: (callback) => {
    const unsubscribe = subscribe('window:request-close', () => {
      Promise.resolve()
        .then(callback)
        .then(
          (approved) => ipcRenderer.invoke('window:confirm-close', approved === true),
          () => ipcRenderer.invoke('window:confirm-close', false)
        )
        .catch((error) => console.warn('Close acknowledgement:', error.message))
    })
    ipcRenderer.send('window:close-ready', true)
    return () => {
      unsubscribe()
      ipcRenderer.send('window:close-ready', false)
    }
  },
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  saveFileAs: (data) => ipcRenderer.invoke('file:save-as', data),
  exportPdf: (data) => ipcRenderer.invoke('file:export-pdf', data),
  exportDocument: (data) => ipcRenderer.invoke('file:export', data),
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  createFile: (data) => ipcRenderer.invoke('file:create', data),

  openFolder: () => ipcRenderer.invoke('folder:open'),
  readFolderTree: (folderPath) => ipcRenderer.invoke('folder:read-tree', folderPath),
  createFolder: (data) => ipcRenderer.invoke('folder:create', data),
  searchFiles: (data) => ipcRenderer.invoke('workspace-search:start', data),
  cancelFileSearch: (id) => ipcRenderer.invoke('workspace-search:cancel', id),
  onFileSearchBatch: (callback) => subscribe('workspace-search:batch', callback),

  renameItem: (data) => ipcRenderer.invoke('item:rename', data),
  deleteItem: (targetPath) => ipcRenderer.invoke('item:delete', targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke('item:show-in-folder', targetPath),

  setWindowTheme: (mode) => ipcRenderer.send('window:set-theme', mode),
  setFullScreen: (flag) => ipcRenderer.invoke('window:set-fullscreen', flag),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullScreenChange: (callback) => subscribe('window:fullscreen-changed', callback),

  setSpellCheckerConfig: (config) => ipcRenderer.invoke('spellcheck:set-config', config),
  getSpellCheckerConfig: () => ipcRenderer.invoke('spellcheck:get-config'),
  setAppLanguage: (lang) => ipcRenderer.invoke('app:set-language', lang),

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
