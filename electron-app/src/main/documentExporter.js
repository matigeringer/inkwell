import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'
import MarkdownIt from 'markdown-it'
import { Document, Packer } from 'docx'
import { atomicWrite } from './storage'
import { validateContent } from './fileService'
import {
  escapeXml,
  tokensToDocx,
  tokensToOdtXml,
  tokensToPlainText,
  exportWarnings
} from './documentModel'
import JSZip from 'jszip'
import { exportDocumentToPdf } from './pdfExporter'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false
})

/**
 * Obtiene el título legible del documento
 */
function resolveDocumentTitle(content, fileName, isEn) {
  if (content) {
    const headingMatch = content.match(/^#\s+(.+)$/m)
    if (headingMatch && headingMatch[1]?.trim()) {
      return headingMatch[1].trim()
    }
  }

  if (fileName) {
    const clean = fileName.replace(/\.[^/.]+$/, '').trim()
    if (clean) return clean
  }

  return isEn ? 'Manuscript' : 'Manuscrito'
}

/**
 * Empaqueta un buffer ODT válido estándar (OpenDocument Text)
 */
async function buildOdtBuffer(title, bodyXml) {
  const zip = new JSZip()

  // 1. mimetype (primero y sin compresión según especificación ODF)
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })

  // 2. META-INF/manifest.xml
  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  zip.file('META-INF/manifest.xml', manifestXml)

  // 3. meta.xml
  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <dc:title>${escapeXml(title)}</dc:title>
  </office:meta>
</office:document-meta>`
  zip.file('meta.xml', metaXml)

  // 4. styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="Newsreader" svg:font-family="Newsreader, Georgia, 'Times New Roman', serif"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties fo:line-height="150%" fo:margin-top="0cm" fo:margin-bottom="0.25cm" fo:text-align="justify"/>
      <style:text-properties style:font-name="Newsreader" fo:font-size="11.5pt" fo:color="#1a1a18"/>
    </style:default-style>
  </office:styles>
</office:document-styles>`
  zip.file('styles.xml', stylesXml)

  // 5. content.xml
  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2">
  <office:automatic-styles>
    ${['ListBullet', 'ListNumber'].map((name) => `<text:list-style style:name="${name}">${Array.from({ length: 10 }, (_, i) => (name === 'ListNumber' ? `<text:list-level-style-number text:level="${i + 1}" style:num-format="1" style:num-suffix="."/>` : `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="•"/>`)).join('')}</text:list-style>`).join('')}
    <style:style style:name="Strike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>
    <style:style style:name="Bold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Italic" style:family="text">
      <style:text-properties fo:font-style="italic"/>
    </style:style>
    <style:style style:name="BoldItalic" style:family="text">
      <style:text-properties fo:font-weight="bold" fo:font-style="italic"/>
    </style:style>
    <style:style style:name="Code" style:family="text">
      <style:text-properties fo:font-family="monospace" fo:font-size="9.5pt" fo:background-color="#f0efea"/>
    </style:style>
    <style:style style:name="Quotations" style:family="paragraph">
      <style:paragraph-properties fo:margin-left="1.2cm" fo:margin-right="0.5cm" fo:margin-top="0.3cm" fo:margin-bottom="0.3cm"/>
      <style:text-properties fo:font-style="italic" fo:color="#333333"/>
    </style:style>
    <style:style style:name="CodeBlock" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.3cm" fo:background-color="#f8f7f2" fo:padding="0.25cm"/>
      <style:text-properties fo:font-family="monospace" fo:font-size="9.5pt"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${bodyXml}
    </office:text>
  </office:body>
</office:document-content>`
  zip.file('content.xml', contentXml)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/**
 * Función central de exportación a múltiples formatos: PDF, Markdown, Texto plano, DOCX, ODT.
 */
export async function exportDocument(event, data = {}, appLanguage = 'es') {
  const isEn = appLanguage === 'en'
  const format = (data.format || 'pdf').toLowerCase()

  // Formato PDF se delega a pdfExporter
  if (format === 'pdf') {
    return exportDocumentToPdf(event, data, appLanguage)
  }

  try {
    let { filePath, fileName, content, title } = data

    // Si no se proporcionó contenido, leer desde el archivo en disco
    if (content == null && filePath) {
      try {
        content = await fs.readFile(filePath, 'utf-8')
      } catch (readErr) {
        return {
          success: false,
          error: isEn
            ? `Could not read file: ${readErr.message}`
            : `No se pudo leer el archivo: ${readErr.message}`
        }
      }
    }

    if (!content && content !== '') {
      return {
        success: false,
        error: isEn ? 'No content to export' : 'No hay contenido para exportar'
      }
    }

    validateContent(content)
    const tokens = md.parse(content, {})
    const warnings = exportWarnings(tokens)

    const effectiveFileName = fileName || (filePath ? basename(filePath) : 'documento.md')
    const baseNameWithoutExt = effectiveFileName.replace(/\.[^/.]+$/, '')
    const effectiveTitle = title || resolveDocumentTitle(content, effectiveFileName, isEn)

    // Configuración de formatos según la opción elegida
    const formatConfigs = {
      markdown: {
        ext: 'md',
        filter: {
          name: isEn ? 'Markdown (*.md)' : 'Markdown (*.md)',
          extensions: ['md', 'markdown']
        },
        dialogTitle: isEn ? 'Export to Markdown' : 'Exportar a Markdown'
      },
      txt: {
        ext: 'txt',
        filter: { name: isEn ? 'Plain text (*.txt)' : 'Texto plano (*.txt)', extensions: ['txt'] },
        dialogTitle: isEn ? 'Export to plain text' : 'Exportar a texto plano'
      },
      docx: {
        ext: 'docx',
        filter: {
          name: isEn ? 'Word Document (*.docx)' : 'Documento de Word (*.docx)',
          extensions: ['docx']
        },
        dialogTitle: isEn ? 'Export to Microsoft Word' : 'Exportar a Microsoft Word (.docx)'
      },
      odt: {
        ext: 'odt',
        filter: {
          name: isEn ? 'OpenDocument Text (*.odt)' : 'Documento LibreOffice / OpenDocument (*.odt)',
          extensions: ['odt']
        },
        dialogTitle: isEn
          ? 'Export to OpenDocument (LibreOffice)'
          : 'Exportar a OpenDocument / LibreOffice (.odt)'
      }
    }

    const config = formatConfigs[format]
    if (!config) {
      return {
        success: false,
        error: isEn ? `Unsupported format: ${format}` : `Formato no soportado: ${format}`
      }
    }

    const defaultTargetName = `${baseNameWithoutExt}.${config.ext}`
    let defaultSavePath = defaultTargetName
    if (filePath) {
      defaultSavePath = join(dirname(filePath), defaultTargetName)
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const saveDialogResult = await dialog.showSaveDialog(win, {
      title: config.dialogTitle,
      defaultPath: defaultSavePath,
      filters: [
        config.filter,
        { name: isEn ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
      ]
    })

    if (saveDialogResult.canceled || !saveDialogResult.filePath) {
      return { canceled: true }
    }

    const destinationPath = saveDialogResult.filePath

    // Generar el archivo según el formato
    if (format === 'markdown') {
      await atomicWrite(destinationPath, content)
    } else if (format === 'txt') {
      const plainText = tokensToPlainText(tokens)
      await atomicWrite(destinationPath, plainText)
    } else if (format === 'docx') {
      const model = tokensToDocx(tokens)
      const doc = new Document({
        title: effectiveTitle,
        numbering: model.numbering,
        sections: [
          {
            properties: {},
            children: model.children
          }
        ]
      })
      const buffer = await Packer.toBuffer(doc)
      await atomicWrite(destinationPath, buffer)
    } else if (format === 'odt') {
      const bodyXml = tokensToOdtXml(tokens)
      const buffer = await buildOdtBuffer(effectiveTitle, bodyXml)
      await atomicWrite(destinationPath, buffer)
    }

    return {
      success: true,
      filePath: destinationPath,
      fileName: basename(destinationPath),
      format,
      warnings
    }
  } catch (error) {
    console.error(`Error al exportar a formato ${format}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}
