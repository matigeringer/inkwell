import { ipcMain } from 'electron'

export function createTrustedIpc(isTrusted) {
  return {
    handle(channel, listener) {
      ipcMain.handle(channel, async (event, ...args) => {
        try {
          if (!isTrusted(event)) throw new Error('Remitente IPC no autorizado')
          return await listener(event, ...args)
        } catch (error) {
          console.error(`${channel}:`, error.message)
          return { success: false, error: error.message }
        }
      })
    },
    on(channel, listener) {
      ipcMain.on(channel, (event, ...args) => {
        if (isTrusted(event)) listener(event, ...args)
      })
    }
  }
}
