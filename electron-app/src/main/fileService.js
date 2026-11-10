import { constants, promises as fs } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { atomicWrite, createQueue, renameWithoutReplacement } from './storage'

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt'])
const IGNORED = new Set(['node_modules', 'dist', 'out', 'build', '$RECYCLE.BIN'])
export const isDocumentPath = (path) => EXTENSIONS.has(extname(path).toLowerCase())
const isIgnoredName = (name) => name.startsWith('.') || IGNORED.has(name)
const hash = (content) => createHash('sha256').update(content).digest('hex')
export const containsPath = (parent, child) => {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

export function validateName(value) {
  if (typeof value !== 'string') throw new Error('Nombre inválido')
  const name = value.trim()
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.length > 240 ||
    /[<>:"/\\|?*]/.test(name) ||
    [...name].some((char) => char.charCodeAt(0) < 32) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  )
    throw new Error(
      'Nombre inválido: usá un nombre simple sin separadores ni caracteres reservados'
    )
  return name
}

export function validateContent(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_DOCUMENT_BYTES) {
    throw new Error('El documento debe ser texto y no superar 10 MiB')
  }
  return content
}

export class FileService {
  constructor(statePath, trashItem) {
    this.statePath = statePath
    this.trashItem = trashItem
    this.roots = new Set()
    this.files = new Set()
    this.versions = new Map()
    this.queue = createQueue()
  }

  async initialize() {
    try {
      const state = JSON.parse(await fs.readFile(this.statePath, 'utf8'))
      if (state.version !== 1 || !Array.isArray(state.roots) || !Array.isArray(state.files)) {
        throw new Error('Registro de permisos inválido')
      }
      this.roots = new Set(state.roots.filter((p) => typeof p === 'string' && isAbsolute(p)))
      this.files = new Set(state.files.filter((p) => typeof p === 'string' && isAbsolute(p)))
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('No se pudieron recuperar permisos:', error)
    }
  }

  async persistGrants() {
    await atomicWrite(
      this.statePath,
      JSON.stringify({ version: 1, roots: [...this.roots], files: [...this.files] })
    )
  }

  async canonical(targetPath, allowMissing = false) {
    if (typeof targetPath !== 'string' || !isAbsolute(targetPath) || targetPath.includes('\0')) {
      throw new Error('Ruta inválida')
    }
    const target = resolve(targetPath)
    try {
      const stat = await fs.lstat(target)
      if (stat.isSymbolicLink()) throw new Error('No se permiten enlaces simbólicos como destino')
      return await fs.realpath(target)
    } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT') throw error
      return join(await fs.realpath(dirname(target)), validateName(basename(target)))
    }
  }

  async authorize(targetPath, { missing = false, directory = false } = {}) {
    const target = await this.canonical(targetPath, missing)
    const roots = await Promise.all(
      [...this.roots].map(async (root) => {
        // A persisted root replaced by a symlink must never widen its permission.
        try {
          return (await this.canonical(root)) === root ? root : null
        } catch {
          return null
        }
      })
    )
    if (
      !roots.some((root) => root && containsPath(root, target)) &&
      (directory || !this.files.has(target))
    ) {
      throw new Error('Acceso no autorizado. Abrí el archivo o carpeta con el selector del sistema')
    }
    return target
  }

  async grantDirectory(selectedPath) {
    return this.queue(async () => {
      const target = await this.canonical(selectedPath)
      if (!(await fs.stat(target)).isDirectory()) throw new Error('La ruta no es una carpeta')
      this.roots.add(target)
      await this.persistGrants()
      return target
    })
  }

  async grantFile(selectedPath) {
    return this.queue(async () => {
      const target = await this.canonical(selectedPath, true)
      this.files.add(target)
      await this.persistGrants()
      return target
    })
  }

  async fingerprint(target) {
    try {
      const stat = await fs.stat(target)
      if (!stat.isFile() || stat.size > MAX_DOCUMENT_BYTES)
        throw new Error('Archivo inválido o mayor a 10 MiB')
      return hash(await fs.readFile(target))
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async readFile(filePath, { remember = true } = {}) {
    return this.queue(async () => {
      const target = await this.authorize(filePath)
      const stat = await fs.stat(target)
      if (!stat.isFile() || stat.size > MAX_DOCUMENT_BYTES)
        throw new Error('Archivo inválido o mayor a 10 MiB')
      const buffer = await fs.readFile(target)
      if (buffer.length > MAX_DOCUMENT_BYTES || buffer.includes(0))
        throw new Error('Archivo demasiado grande o binario')
      if (remember) this.versions.set(target, hash(buffer))
      return {
        success: true,
        filePath: target,
        fileName: basename(target),
        content: buffer.toString('utf8')
      }
    })
  }

  async searchDirectory(path, rootPath = path) {
    const root = await this.authorize(rootPath, { directory: true })
    const directory = await this.authorize(path, { directory: true })
    if (
      root !== resolve(rootPath) ||
      directory !== resolve(path) ||
      !containsPath(root, directory) ||
      relative(root, directory).split(sep).some(isIgnoredName)
    ) {
      throw new Error('Carpeta fuera del alcance de búsqueda')
    }
    return directory
  }

  async searchDocument(path, directory) {
    const target = await this.authorize(path)
    if (
      target !== resolve(path) ||
      (directory && !containsPath(directory, target)) ||
      !isDocumentPath(target) ||
      !(await fs.lstat(target)).isFile()
    ) {
      throw new Error('Archivo fuera del alcance de búsqueda')
    }
    return target
  }

  async readSearchDocument(path, directory, byteBudget) {
    // Bound the read even if the file grows after stat. Search never changes save baselines.
    const file = await fs.open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    )
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.size > MAX_DOCUMENT_BYTES) throw new Error('Archivo inválido')
      if (stat.size > byteBudget) return null
      await this.searchDocument(path, directory)
      const current = await fs.lstat(path)
      if (stat.dev !== current.dev || stat.ino !== current.ino)
        throw new Error('Archivo modificado')
      const buffer = Buffer.allocUnsafe(stat.size)
      let bytesRead = 0
      while (bytesRead < buffer.length) {
        const read = await file.read(buffer, { offset: bytesRead, position: bytesRead })
        if (!read.bytesRead) break
        bytesRead += read.bytesRead
      }
      const content = buffer.subarray(0, bytesRead)
      return { bytesRead, content: content.includes(0) ? null : content.toString('utf8') }
    } finally {
      await file.close()
    }
  }

  async saveFile(filePath, content, { selected = false } = {}) {
    validateContent(content)
    return this.queue(async () => {
      const target = await this.authorize(filePath, { missing: true })
      const current = await this.fingerprint(target)
      if (!selected && (!this.versions.has(target) || this.versions.get(target) !== current)) {
        throw new Error(
          'El archivo cambió fuera de Inkwell o fue eliminado. Guardá una copia con «Guardar como»'
        )
      }
      await atomicWrite(target, content)
      this.versions.set(target, hash(Buffer.from(content)))
      return { success: true, filePath: target, fileName: basename(target) }
    })
  }

  async create(parentPath, name, directory = false, content = '') {
    name = validateName(name)
    if (!directory && !extname(name)) name += '.md'
    if (!directory && !EXTENSIONS.has(extname(name).toLowerCase()))
      throw new Error('Extensión no soportada')
    validateContent(content)
    return this.queue(async () => {
      const parent = await this.authorize(parentPath, { directory: true })
      const target = join(parent, name)
      if (directory) await fs.mkdir(target)
      else {
        await fs.writeFile(target, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
        this.versions.set(target, hash(Buffer.from(content)))
      }
      return {
        success: true,
        filePath: target,
        fileName: name,
        folderPath: target,
        folderName: name
      }
    })
  }

  async rename(oldPath, name) {
    name = validateName(name)
    return this.queue(async () => {
      const source = await this.authorize(oldPath)
      if ((await fs.lstat(source)).isFile() && !EXTENSIONS.has(extname(name).toLowerCase())) {
        throw new Error('El archivo debe conservar una extensión de documento soportada')
      }
      const target = join(dirname(source), name)
      if (source === target)
        return { success: true, oldPath: source, newPath: target, newName: name }
      const sameEntry = await fs.realpath(target).then(
        (path) => path === source,
        (error) => {
          if (error.code !== 'ENOENT') throw error
          return false
        }
      )
      if (sameEntry) {
        const temporary = join(dirname(source), `.rename-${randomUUID()}`)
        await renameWithoutReplacement(source, temporary)
        try {
          await renameWithoutReplacement(temporary, target)
        } catch (error) {
          await renameWithoutReplacement(temporary, source)
          throw error
        }
      } else await renameWithoutReplacement(source, target)
      const replace = (p) => (containsPath(source, p) ? target + p.slice(source.length) : p)
      this.roots = new Set([...this.roots].map(replace))
      this.files = new Set([...this.files].map(replace))
      this.versions = new Map([...this.versions].map(([p, version]) => [replace(p), version]))
      let warning
      try {
        await this.persistGrants()
      } catch (error) {
        warning = `No se pudo persistir el acceso: ${error.message}`
      }
      return { success: true, oldPath: source, newPath: target, newName: name, warning }
    })
  }

  async delete(targetPath) {
    return this.queue(async () => {
      const target = await this.authorize(targetPath)
      await this.trashItem(target)
      this.roots = new Set([...this.roots].filter((p) => !containsPath(target, p)))
      this.files = new Set([...this.files].filter((p) => !containsPath(target, p)))
      // Keep a tombstone: saving an open, deleted file must report a conflict.
      for (const p of this.versions.keys())
        if (containsPath(target, p)) this.versions.set(p, 'deleted')
      let warning
      try {
        await this.persistGrants()
      } catch (error) {
        warning = `No se pudo persistir el acceso: ${error.message}`
      }
      return { success: true, targetPath: target, warning }
    })
  }

  async readTree(folderPath, { signal } = {}) {
    const root = await this.authorize(folderPath, { directory: true })
    if (signal && root !== resolve(folderPath)) throw new Error('Ruta de búsqueda modificada')
    const warnings = []
    let count = 0
    const visit = async (directory, depth) => {
      signal?.throwIfAborted()
      if (depth > 8 || count > 20000) {
        warnings.push(`Carpeta omitida por tamaño/profundidad: ${directory}`)
        return []
      }
      if (signal && (await this.canonical(directory)) !== directory) {
        throw new Error('Ruta de búsqueda modificada')
      }
      const entries = await fs.readdir(directory, { withFileTypes: true })
      const children = []
      for (const entry of entries) {
        signal?.throwIfAborted()
        if (isIgnoredName(entry.name) || entry.isSymbolicLink()) continue
        count++
        if (count > 20000) {
          warnings.push('Se alcanzó el límite de 20000 elementos')
          break
        }
        const target = join(directory, entry.name)
        if (entry.isDirectory()) {
          try {
            children.push({
              name: entry.name,
              path: target,
              isDirectory: true,
              children: await visit(target, depth + 1)
            })
          } catch (error) {
            signal?.throwIfAborted()
            warnings.push(`${target}: ${error.message}`)
          }
        } else if (entry.isFile() && isDocumentPath(target)) {
          children.push({ name: entry.name, path: target, isDirectory: false })
        }
      }
      return children.sort(
        (a, b) =>
          Number(b.isDirectory) - Number(a.isDirectory) ||
          a.name.localeCompare(b.name, undefined, { numeric: true })
      )
    }
    const tree = await visit(root, 0)
    return {
      success: true,
      folderPath: root,
      folderName: basename(root),
      tree,
      warnings,
      partial: warnings.length > 0
    }
  }
}
