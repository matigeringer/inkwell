import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'
import { atomicWrite, createQueue } from './storage'

const serialize = createQueue()
const MAX_THREADS = 500
const MAX_COMMENTS_PER_THREAD = 100
const MAX_COMMENT_LENGTH = 8000
const MAX_QUOTE_LENGTH = 4000
const MAX_CONTEXT_LENGTH = 64

function getCommentsBaseDir() {
  return join(app.getPath('userData'), 'fountain_comments')
}

function getDocHash(docKey) {
  if (typeof docKey !== 'string' || !docKey || docKey.length > 4096) {
    throw new Error('Identificador de comentarios inválido')
  }
  return crypto.createHash('sha256').update(String(docKey)).digest('hex').slice(0, 20)
}

function getDocCommentsDir(docKey) {
  return join(getCommentsBaseDir(), getDocHash(docKey))
}

function sanitizeAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return null
  const quote = typeof anchor.quote === 'string' ? anchor.quote.slice(0, MAX_QUOTE_LENGTH) : ''
  if (!quote) return null
  const fromOffset = Math.max(0, Math.floor(Number(anchor.fromOffset) || 0))
  const toOffset = Math.max(fromOffset, Math.floor(Number(anchor.toOffset) || fromOffset))
  return {
    quote,
    prefix: typeof anchor.prefix === 'string' ? anchor.prefix.slice(-MAX_CONTEXT_LENGTH) : '',
    suffix: typeof anchor.suffix === 'string' ? anchor.suffix.slice(0, MAX_CONTEXT_LENGTH) : '',
    fromOffset,
    toOffset
  }
}

function sanitizeComment(item) {
  if (!item || typeof item !== 'object') return null
  const body = typeof item.body === 'string' ? item.body.trim().slice(0, MAX_COMMENT_LENGTH) : ''
  if (!body) return null
  const now = Date.now()
  const createdAt = Number.isFinite(item.createdAt) ? item.createdAt : now
  const updatedAt = Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt
  return {
    id: typeof item.id === 'string' && item.id ? item.id.slice(0, 128) : crypto.randomUUID(),
    body,
    createdAt,
    updatedAt
  }
}

export function sanitizeThreads(threads) {
  if (!Array.isArray(threads)) return []
  const result = []
  for (const rawThread of threads) {
    if (!rawThread || typeof rawThread !== 'object') continue
    const anchor = sanitizeAnchor(rawThread.anchor)
    if (!anchor) continue
    const rawComments = Array.isArray(rawThread.comments) ? rawThread.comments : []
    const comments = []
    for (const rawComment of rawComments) {
      const comment = sanitizeComment(rawComment)
      if (comment) comments.push(comment)
      if (comments.length >= MAX_COMMENTS_PER_THREAD) break
    }
    if (!comments.length) continue
    result.push({
      id:
        typeof rawThread.id === 'string' && rawThread.id
          ? rawThread.id.slice(0, 128)
          : crypto.randomUUID(),
      anchor,
      comments,
      createdAt: Number.isFinite(rawThread.createdAt) ? rawThread.createdAt : comments[0].createdAt
    })
    if (result.length >= MAX_THREADS) break
  }
  return result
}

async function readDocCommentsFile(docDir) {
  const filePath = join(docDir, 'comments.json')
  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    if (!data || data.version !== 1 || !Array.isArray(data.threads)) {
      throw new Error('Índice de comentarios inválido')
    }
    return {
      ...data,
      threads: sanitizeThreads(data.threads)
    }
  } catch (error) {
    if (error.code === 'ENOENT') return null
    await fs
      .copyFile(filePath, join(docDir, `comments.corrupt.${crypto.randomUUID()}.json`))
      .catch(() => {})
    return null
  }
}

async function writeDocCommentsFile(docDir, payload) {
  await fs.mkdir(docDir, { recursive: true })
  await atomicWrite(join(docDir, 'comments.json'), JSON.stringify(payload, null, 2))
}

async function _getDocComments(docKey) {
  try {
    if (!docKey) return { success: true, threads: [] }
    const docDir = getDocCommentsDir(docKey)
    const data = await readDocCommentsFile(docDir)
    if (!data) return { success: true, threads: [] }
    return {
      success: true,
      docName: data.docName,
      filePath: data.filePath,
      threads: data.threads
    }
  } catch (error) {
    console.error('Error al obtener comentarios del documento:', error)
    return { success: false, error: error.message, threads: [] }
  }
}

async function _saveDocComments({ docKey, docName, filePath, threads }) {
  try {
    if (!docKey) return { success: false, error: 'docKey no especificado' }
    const docDir = getDocCommentsDir(docKey)
    const cleanThreads = sanitizeThreads(threads)
    if (!cleanThreads.length) {
      await fs.rm(join(docDir, 'comments.json'), { force: true })
      await fs.rmdir(docDir).catch(() => {})
      return { success: true, threads: [] }
    }
    const payload = {
      version: 1,
      docKey,
      docName: docName || 'document.md',
      filePath: filePath || null,
      threads: cleanThreads
    }
    await writeDocCommentsFile(docDir, payload)
    return { success: true, threads: cleanThreads }
  } catch (error) {
    console.error('Error al guardar comentarios del documento:', error)
    return { success: false, error: error.message }
  }
}

async function _moveDocComments({ fromKey, toKey, docName, filePath }) {
  try {
    if (!fromKey || !toKey || fromKey === toKey) return { success: true }
    const source = getDocCommentsDir(fromKey)
    const destination = getDocCommentsDir(toKey)
    const sourceData = await readDocCommentsFile(source)
    if (!sourceData || !sourceData.threads.length) return { success: true }

    const targetData = (await readDocCommentsFile(destination)) || { threads: [] }
    const merged = [...targetData.threads]
    for (const thread of sourceData.threads) {
      if (!merged.some((item) => item.id === thread.id)) {
        merged.push(thread)
      }
    }
    await writeDocCommentsFile(destination, {
      version: 1,
      docKey: toKey,
      docName: docName || sourceData.docName || 'document.md',
      filePath: filePath ?? null,
      threads: sanitizeThreads(merged)
    })
    await fs.rm(join(source, 'comments.json'), { force: true })
    await fs.rmdir(source).catch(() => {})
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getDocComments = (...args) => serialize(() => _getDocComments(...args))

export const saveDocComments = (...args) => serialize(() => _saveDocComments(...args))

export const moveDocComments = (...args) => serialize(() => _moveDocComments(...args))

export const moveCommentsPaths = (fromPath, toPath) =>
  serialize(async () => {
    const base = getCommentsBaseDir()
    let entries
    try {
      entries = await fs.readdir(base, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return { success: true }
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const data = await readDocCommentsFile(join(base, entry.name))
      const key = data?.docKey || data?.filePath
      if (typeof key !== 'string') continue
      if (key === fromPath || key.startsWith(fromPath + '/') || key.startsWith(fromPath + '\\')) {
        const next = toPath + key.slice(fromPath.length)
        const result = await _moveDocComments({
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
