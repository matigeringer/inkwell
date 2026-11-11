import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { scanWorkspace, searchInWorker } from './workspaceSearch'

export function registerWorkspaceSearchIpc({ handle }, fileService) {
  const searches = new Map()

  const cancel = (sender) => {
    searches.get(sender)?.controller.abort()
    searches.delete(sender)
  }

  handle('workspace-search:start', async ({ sender }, request) => {
    if (typeof request?.id !== 'string' || request.id.length > 100) {
      throw new Error('Identificador de búsqueda inválido')
    }

    cancel(sender)
    const controller = new AbortController()
    const search = { id: request.id, controller }
    searches.set(sender, search)
    let worker

    try {
      return await scanWorkspace(fileService, request, {
        signal: controller.signal,
        publish(batch) {
          if (searches.get(sender) === search && !sender.isDestroyed()) {
            sender.send('workspace-search:batch', { id: search.id, ...batch })
          }
        },
        searchText(data) {
          if (!worker) {
            worker = new Worker(join(__dirname, 'workspace-search-worker.js'))
            // A worker can fail between requests, when no search listener is attached.
            worker.on('error', () => {})
          }
          return searchInWorker(worker, data, controller.signal)
        }
      })
    } catch (error) {
      if (controller.signal.aborted) return { canceled: true }
      throw error
    } finally {
      if (searches.get(sender) === search) searches.delete(sender)
      await worker?.terminate()
    }
  })

  handle('workspace-search:cancel', ({ sender }, id) => {
    if (searches.get(sender)?.id === id) cancel(sender)
  })

  return cancel
}
