import { basename, relative } from 'node:path'
import { validateContent } from './fileService'

const BYTE_LIMIT = 128 * 1024 * 1024
const RESULT_LIMIT = 500

function* filesInTree(tree) {
  for (const item of tree) {
    if (item.isDirectory) yield* filesInTree(item.children)
    else yield item.path
  }
}

export async function scanWorkspace(
  files,
  { query, scope, activeFile },
  { signal, publish, searchText, byteLimit = BYTE_LIMIT, resultLimit = RESULT_LIMIT }
) {
  if (
    typeof query !== 'string' ||
    query.length > 512 ||
    !query.trim() ||
    typeof scope?.path !== 'string' ||
    typeof scope.rootPath !== 'string'
  ) {
    throw new Error('Consulta de archivos inválida')
  }

  query = query.trim()
  signal.throwIfAborted()
  const directory = await files.searchDirectory(scope.path, scope.rootPath)
  const { tree, warnings } = await files.readTree(directory, { signal })
  let remainingBytes = byteLimit
  let count = 0
  let skipped = warnings.length
  let limited = false
  let lastPublished = Date.now()
  const groups = []

  function flush() {
    signal.throwIfAborted()
    publish({ groups: groups.splice(0), skipped, limited })
    lastPublished = Date.now()
  }

  for (const path of filesInTree(tree)) {
    signal.throwIfAborted()

    let target
    let content
    let sourceMode
    try {
      target = await files.searchDocument(path, directory)
      if (activeFile?.path === target) {
        content = validateContent(activeFile.content)
        if (typeof activeFile.sourceMode === 'boolean') sourceMode = activeFile.sourceMode
      } else {
        const read = await files.readSearchDocument(target, directory, remainingBytes)
        if (!read) {
          limited = true
          break
        }
        remainingBytes -= read.bytesRead
        if (read.content === null) throw new Error('Archivo binario')
        content = read.content
      }
    } catch {
      signal.throwIfAborted()
      skipped++
      if (Date.now() - lastPublished >= 125) flush()
      continue
    }

    signal.throwIfAborted()
    const { matches, version, truncated, error } = await searchText({
      content,
      fileName: basename(target),
      sourceMode,
      query,
      limit: resultLimit - count
    })
    if (error) skipped++
    else {
      if (matches.length) {
        groups.push({
          path: target,
          folderPath: scope.rootPath,
          relativePath: relative(directory, target),
          matches,
          version
        })
      }
      count += matches.length
      if (truncated) {
        limited = true
        break
      }
    }
    if (groups.length >= 20 || Date.now() - lastPublished >= 125) flush()
  }

  flush()
  return { success: true, count, skipped, limited }
}

export function searchInWorker(worker, request, signal) {
  signal.throwIfAborted()
  if (worker.threadId === -1) throw new Error('El proceso de búsqueda se cerró')
  return new Promise((resolve, reject) => {
    const finish = (value, error) => {
      signal.removeEventListener('abort', onAbort)
      worker.off('message', onMessage)
      worker.off('error', onError)
      worker.off('exit', onExit)
      if (error) reject(error)
      else resolve(value)
    }
    const onAbort = () => finish(null, signal.reason)
    const onError = (error) => finish(null, error)
    const onExit = () => onError(new Error('El proceso de búsqueda se cerró'))
    const onMessage = (value) => finish(value)
    signal.addEventListener('abort', onAbort, { once: true })
    worker.once('message', onMessage)
    worker.once('error', onError)
    worker.once('exit', onExit)
    try {
      worker.postMessage(request)
    } catch (error) {
      onError(error)
    }
  })
}
