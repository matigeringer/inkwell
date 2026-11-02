import { promises as fs, constants } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

export function createQueue() {
  let pending = Promise.resolve()
  return (operation) => {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }
}

// The temporary file stays on the same volume. Failure before rename leaves the original intact.
export async function atomicWrite(filePath, content, { mode = 0o600 } = {}) {
  const temporary = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`)
  let handle
  try {
    const existing = await fs.lstat(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return null
    })
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
      throw new Error('El destino debe ser un archivo regular, sin enlaces simbólicos')
    }
    if (existing) await fs.access(filePath, constants.W_OK)
    handle = await fs.open(temporary, 'wx', existing ? existing.mode & 0o777 : mode)
    await handle.writeFile(content)
    await handle.sync()
    await handle.close()
    handle = null
    await fs.rename(temporary, filePath)
  } finally {
    if (handle) await handle.close()
    await fs.unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') console.warn('No se pudo limpiar el temporal:', error.message)
    })
  }
}

// Node does not expose renameat2(RENAME_NOREPLACE). Exclusive destination creation
// avoids replacing existing items on every platform; directory moves roll back on failure.
export async function renameWithoutReplacement(source, destination) {
  const stat = await fs.lstat(source)
  if (stat.isSymbolicLink()) {
    await fs.symlink(await fs.readlink(source), destination)
    try {
      await fs.unlink(source)
    } catch (error) {
      await fs.unlink(destination)
      throw error
    }
  } else if (stat.isFile()) {
    await fs.link(source, destination)
    try {
      await fs.unlink(source)
    } catch (error) {
      await fs.unlink(destination)
      throw error
    }
  } else if (stat.isDirectory()) {
    await fs.mkdir(destination, { mode: stat.mode & 0o777 })
    const moved = []
    try {
      for (const name of await fs.readdir(source)) {
        await renameWithoutReplacement(join(source, name), join(destination, name))
        moved.push(name)
      }
      await fs.rmdir(source)
    } catch (error) {
      for (const name of moved.reverse()) {
        await renameWithoutReplacement(join(destination, name), join(source, name)).catch(
          (rollbackError) => {
            error.message += `; rollback: ${rollbackError.message}`
          }
        )
      }
      await fs.rmdir(destination).catch(() => {})
      throw error
    }
  } else {
    throw new Error('Tipo de archivo no soportado')
  }
}
