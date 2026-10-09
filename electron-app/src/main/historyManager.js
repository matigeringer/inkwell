import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

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
  if (!docKey) return 'unknown_doc'
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
    const raw = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Guarda los metadatos de un documento en su directorio
 */
async function writeDocMeta(docDir, meta) {
  const metaPath = join(docDir, 'meta.json')
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

/**
 * Guarda una nueva instantánea temporal en el historial
 */
export async function saveSnapshot({
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

    const snapshotId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const snapshotFileName = `${snapshotId}.md`
    const snapshotFilePath = join(docDir, snapshotFileName)

    // Guardar archivo con el contenido Markdown íntegro
    await fs.writeFile(snapshotFilePath, content, 'utf-8')

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
    const limit = Math.max(5, Number(maxEntries) || 50)
    if (meta.snapshots.length > limit) {
      const toRemove = meta.snapshots.slice(limit)
      meta.snapshots = meta.snapshots.slice(0, limit)

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
export async function getSnapshots(docKey) {
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
export async function getSnapshotContent({ docKey, snapshotId }) {
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
export async function deleteSnapshot({ docKey, snapshotId }) {
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
export async function clearDocHistory(docKey) {
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
export async function clearAllHistory() {
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
export async function pruneAllHistory(maxEntries) {
  try {
    const baseDir = getHistoryBaseDir()
    const limit = Math.max(5, Number(maxEntries) || 50)

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
