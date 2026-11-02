import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import crypto from 'crypto'
import { atomicWrite, createQueue } from './storage'
import { validateContent } from './fileService'

const serialize = createQueue()
const snapshotFile = (name) => typeof name === 'string' && /^\d+_[a-z0-9-]+\.md$/.test(name)
const historyLimit = (value) => Math.min(500, Math.max(5, Math.floor(Number(value) || 50)))

/**
 * Obtiene la ruta del directorio base para el historial de documentos
 */
function getHistoryBaseDir() {
  return join(app.getPath('userData'), 'fountain_history')
}

/**
 * Genera un identificador seguro para el sistema de archivos a partir de docKey
 */
function getDocHash(docKey) {
  if (typeof docKey !== 'string' || !docKey || docKey.length > 4096)
    throw new Error('Identificador de historial inválido')
  return crypto.createHash('sha256').update(String(docKey)).digest('hex').slice(0, 20)
}

/**
 * Obtiene la ruta del directorio de un documento específico
 */
function getDocHistoryDir(docKey) {
  const hash = getDocHash(docKey)
  return join(getHistoryBaseDir(), hash)
}

/**
 * Lee los metadatos de un documento del historial
 */
async function readDocMeta(docDir) {
  const metaPath = join(docDir, 'meta.json')
  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
    if (
      !Array.isArray(meta.snapshots) ||
      !meta.snapshots.every(
        (item) =>
          snapshotFile(item.file) &&
          item.file === `${item.id}.md` &&
          Number.isFinite(item.timestamp)
      )
    ) {
      throw new Error('Índice de historial inválido')
    }
    return meta
  } catch (error) {
    if (error.code && error.code !== 'ENOENT') throw error
    let entries
    try {
      entries = await fs.readdir(docDir)
    } catch (readError) {
      if (readError.code === 'ENOENT') return null
      throw readError
    }
    if (error.code !== 'ENOENT') {
      await fs.copyFile(metaPath, join(docDir, `meta.corrupt.${crypto.randomUUID()}.json`))
    }
    const snapshots = []
    for (const file of entries.filter(snapshotFile)) {
      const content = await fs.readFile(join(docDir, file), 'utf8')
      const id = file.slice(0, -3)
      snapshots.push({
        id,
        file,
        timestamp: Number(id.split('_')[0]),
        trigger: 'recovered',
        words: content.trim() ? content.trim().split(/\s+/).length : 0,
        characters: content.length,
        preview: content.slice(0, 160).replace(/[\r\n]+/g, ' ')
      })
    }
    if (!snapshots.length && error.code === 'ENOENT') return null
    snapshots.sort((a, b) => b.timestamp - a.timestamp)
    const meta = { docName: 'document.md', filePath: null, snapshots, recovered: true }
    await writeDocMeta(docDir, meta)
    return meta
  }
}

/**
 * Guarda los metadatos de un documento en su directorio
 */
async function writeDocMeta(docDir, meta) {
  const metaPath = join(docDir, 'meta.json')
  await atomicWrite(metaPath, JSON.stringify(meta, null, 2))
}

/**
 * Guarda una nueva instantánea temporal en el historial
 */
async function _saveSnapshot({
  docKey,
  docName,
  filePath,
  content = '',
  trigger = 'auto',
  words = 0,
  characters = 0,
  maxEntries = 50
}) {
  try {
    if (!docKey) {
      return { success: false, error: 'docKey no especificado' }
    }

    validateContent(content)
    const docDir = getDocHistoryDir(docKey)
    await fs.mkdir(docDir, { recursive: true })

    let meta = await readDocMeta(docDir)
    if (!meta) {
      meta = {
        docKey,
        docName: docName || 'document.md',
        filePath: filePath || null,
        snapshots: []
      }
    } else {
      meta.docName = docName || meta.docName
      if (filePath) meta.filePath = filePath
    }

    // Verificar si el contenido es exactamente igual a la última instantánea
    if (meta.snapshots.length > 0) {
      const lastSnapshot = meta.snapshots[0]
      const lastFilePath = join(docDir, lastSnapshot.file)
      try {
        const lastContent = await fs.readFile(lastFilePath, 'utf-8')
        if (lastContent === content) {
          // Si el contenido es 100% idéntico, no duplicamos la snapshot
          return { success: true, duplicate: true, snapshot: lastSnapshot }
        }
      } catch {
        // Si no se pudo leer el archivo previo, continuamos con el guardado
      }
    }

    const snapshotId = `${Date.now()}_${crypto.randomUUID()}`
    const snapshotFileName = `${snapshotId}.md`
    const snapshotFilePath = join(docDir, snapshotFileName)

    // Guardar archivo con el contenido Markdown íntegro
    await atomicWrite(snapshotFilePath, content)

    // Generar un extracto breve para vista previa rápida
    const preview = content
      .trim()
      .slice(0, 160)
      .replace(/[\r\n]+/g, ' ')

    const newSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      trigger, // 'auto' | 'manual'
      words: Number(words) || 0,
      characters: Number(characters) || 0,
      preview,
      file: snapshotFileName
    }

    // Insertar al inicio (orden cronológico descendente)
    meta.snapshots.unshift(newSnapshot)

    // Poda FIFO si excede maxEntries
    const limit = historyLimit(maxEntries)
    if (meta.snapshots.length > limit) {
      const toRemove = meta.snapshots.slice(limit)
      meta.snapshots = meta.snapshots.slice(0, limit)

      await writeDocMeta(docDir, meta)
      for (const item of toRemove) {
        try {
          await fs.unlink(join(docDir, item.file))
        } catch {
          // Ignorar si ya fue eliminado
        }
      }
    }

    await writeDocMeta(docDir, meta)

    return {
      success: true,
      snapshot: newSnapshot,
      totalSnapshots: meta.snapshots.length
    }
  } catch (error) {
    console.error('Error al guardar snapshot de historial:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Obtiene la lista de instantáneas de un documento
 */
async function _getSnapshots(docKey) {
  try {
    if (!docKey) return { success: true, snapshots: [] }

    const docDir = getDocHistoryDir(docKey)
    const meta = await readDocMeta(docDir)

    if (!meta || !Array.isArray(meta.snapshots)) {
      return { success: true, snapshots: [] }
    }

    return {
      success: true,
      docName: meta.docName,
      filePath: meta.filePath,
      snapshots: meta.snapshots
    }
  } catch (error) {
    console.error('Error al obtener snapshots de historial:', error)
    return { success: false, error: error.message, snapshots: [] }
  }
}

/**
 * Obtiene el contenido completo de una instantánea específica
 */
async function _getSnapshotContent({ docKey, snapshotId }) {
  try {
    if (!docKey || !snapshotId) {
      return { success: false, error: 'Parámetros insuficientes' }
    }

    const docDir = getDocHistoryDir(docKey)
    const meta = await readDocMeta(docDir)

    if (!meta || !Array.isArray(meta.snapshots)) {
      return { success: false, error: 'Documento sin historial' }
    }

    const targetSnapshot = meta.snapshots.find((s) => s.id === snapshotId)
    if (!targetSnapshot) {
      return { success: false, error: 'Instantánea no encontrada' }
    }

    const filePath = join(docDir, targetSnapshot.file)
    const content = await fs.readFile(filePath, 'utf-8')

    return {
      success: true,
      snapshot: targetSnapshot,
      content
    }
  } catch (error) {
    console.error('Error al leer contenido de snapshot:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Elimina una instantánea específica del historial
 */
async function _deleteSnapshot({ docKey, snapshotId }) {
  try {
    if (!docKey || !snapshotId) {
      return { success: false, error: 'Parámetros insuficientes' }
    }

    const docDir = getDocHistoryDir(docKey)
    const meta = await readDocMeta(docDir)

    if (!meta || !Array.isArray(meta.snapshots)) {
      return { success: true }
    }

    const targetIndex = meta.snapshots.findIndex((s) => s.id === snapshotId)
    if (targetIndex !== -1) {
      const [removed] = meta.snapshots.splice(targetIndex, 1)
      await writeDocMeta(docDir, meta)
      try {
        await fs.unlink(join(docDir, removed.file))
      } catch {
        // Ignorar si el archivo no existe
      }
      await writeDocMeta(docDir, meta)
    }

    return { success: true, remaining: meta.snapshots.length }
  } catch (error) {
    console.error('Error al eliminar snapshot:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Borra todo el historial de un documento
 */
async function _clearDocHistory(docKey) {
  try {
    if (!docKey) return { success: true }
    const docDir = getDocHistoryDir(docKey)
    await fs.rm(docDir, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    console.error('Error al limpiar historial del documento:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Borra todo el historial de la aplicación
 */
async function _clearAllHistory() {
  try {
    const baseDir = getHistoryBaseDir()
    await fs.rm(baseDir, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    console.error('Error al limpiar todo el historial:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Poda el historial de todos los documentos para ajustarse a un nuevo límite máximo
 */
async function _pruneAllHistory(maxEntries) {
  try {
    const baseDir = getHistoryBaseDir()
    const limit = historyLimit(maxEntries)

    try {
      await fs.access(baseDir)
    } catch {
      return { success: true }
    }

    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const docDir = join(baseDir, entry.name)
        const meta = await readDocMeta(docDir)
        if (meta && Array.isArray(meta.snapshots) && meta.snapshots.length > limit) {
          const toRemove = meta.snapshots.slice(limit)
          meta.snapshots = meta.snapshots.slice(0, limit)
          await writeDocMeta(docDir, meta)
          for (const item of toRemove) {
            try {
              await fs.unlink(join(docDir, item.file))
            } catch {
              // Ignorar si ya fue eliminado
            }
          }
          await writeDocMeta(docDir, meta)
        }
      }
    }
    return { success: true }
  } catch (error) {
    console.error('Error al podar historial general:', error)
    return { success: false, error: error.message }
  }
}

async function _moveDocHistory({ fromKey, toKey, docName, filePath }) {
  try {
    if (fromKey === toKey) return { success: true }
    const source = getDocHistoryDir(fromKey)
    const destination = getDocHistoryDir(toKey)
    const sourceMeta = await readDocMeta(source)
    if (!sourceMeta) return { success: true }
    await fs.mkdir(destination, { recursive: true })
    const targetMeta = (await readDocMeta(destination)) || { snapshots: [] }
    for (const snapshot of sourceMeta.snapshots) {
      if (!targetMeta.snapshots.some((item) => item.id === snapshot.id)) {
        await fs.copyFile(join(source, snapshot.file), join(destination, snapshot.file))
        targetMeta.snapshots.push(snapshot)
      }
    }
    targetMeta.snapshots.sort((a, b) => b.timestamp - a.timestamp)
    Object.assign(targetMeta, { docKey: toKey, docName, filePath })
    await writeDocMeta(destination, targetMeta)
    // Preserve the source history as a recovery copy; do not erase it during a path change.
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const saveSnapshot = (...args) => serialize(() => _saveSnapshot(...args))

export const getSnapshots = (...args) => serialize(() => _getSnapshots(...args))

export const getSnapshotContent = (...args) => serialize(() => _getSnapshotContent(...args))

export const deleteSnapshot = (...args) => serialize(() => _deleteSnapshot(...args))

export const clearDocHistory = (...args) => serialize(() => _clearDocHistory(...args))

export const clearAllHistory = (...args) => serialize(() => _clearAllHistory(...args))

export const pruneAllHistory = (...args) => serialize(() => _pruneAllHistory(...args))

export const moveDocHistory = (...args) => serialize(() => _moveDocHistory(...args))

export const moveHistoryPaths = (fromPath, toPath) =>
  serialize(async () => {
    const base = getHistoryBaseDir()
    let entries
    try {
      entries = await fs.readdir(base, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return { success: true }
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const meta = await readDocMeta(join(base, entry.name))
      const key = meta?.docKey || meta?.filePath
      if (typeof key !== 'string') continue
      if (key === fromPath || key.startsWith(fromPath + '/') || key.startsWith(fromPath + '\\')) {
        const next = toPath + key.slice(fromPath.length)
        const result = await _moveDocHistory({
          fromKey: key,
          toKey: next,
          docName: next.split(/[\\/]/).pop(),
          filePath: next
        })
        if (!result.success) return result
      }
    }
    return { success: true }
  })
