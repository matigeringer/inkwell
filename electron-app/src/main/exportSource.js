import { BrowserWindow, dialog } from 'electron'
import { basename, dirname, join } from 'node:path'
import MarkdownIt from 'markdown-it'
import { validateContent } from './fileService'

export const exportMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false
})

export function getExportSource({ filePath, fileName, title, content }, english) {
  if (content == null) {
    throw new Error(english ? 'No content to export' : 'No hay contenido para exportar')
  }
  validateContent(content)

  const name = fileName || (filePath ? basename(filePath) : 'documento.md')
  const stem = name.replace(/\.[^/.]+$/, '')
  const heading = content.match(/^#\s+(.+)$/m)?.[1].trim()
  return {
    filePath,
    content,
    stem,
    title: title || heading || stem.trim() || (english ? 'Manuscript' : 'Manuscrito')
  }
}

export async function chooseExportPath(sender, source, { ext, title, filter }, english) {
  const fileName = `${source.stem}.${ext}`
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(sender), {
    title,
    defaultPath: source.filePath ? join(dirname(source.filePath), fileName) : fileName,
    filters: [
      filter,
      { name: english ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
    ]
  })
  return result.canceled ? null : result.filePath
}
