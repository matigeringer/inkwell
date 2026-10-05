import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Archivos
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  saveFileAs: (data) => ipcRenderer.invoke('file:save-as', data),
  exportPdf: (data) => ipcRenderer.invoke('file:export-pdf', data),
  openFileDialog: () => ipcRenderer.invoke('file:open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  createFile: (data) => ipcRenderer.invoke('file:create', data),

  // Carpetas y Espacios de Trabajo
  openFolder: () => ipcRenderer.invoke('folder:open'),
  readFolderTree: (folderPath) => ipcRenderer.invoke('folder:read-tree', folderPath),
  createFolder: (data) => ipcRenderer.invoke('folder:create', data),

  // Operaciones comunes
  renameItem: (data) => ipcRenderer.invoke('item:rename', data),
  deleteItem: (targetPath) => ipcRenderer.invoke('item:delete', targetPath),
  showInFolder: (targetPath) => ipcRenderer.invoke('item:show-in-folder', targetPath),

  // Control de Pantalla Completa / Zen
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
  setAppLanguage: (lang) => ipcRenderer.invoke('app:set-language', lang)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
