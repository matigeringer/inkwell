import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'
import MarkdownIt from 'markdown-it'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } from 'docx'
import JSZip from 'jszip'
import { exportDocumentToPdf } from './pdfExporter'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false
})

/**
 * Escapa caracteres XML para el archivo content.xml de ODT
 */
function escapeXml(unsafe) {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

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
 * Convierte Markdown a texto plano legible sin sintaxis
 */
function markdownToPlainText(mdText) {
  if (!mdText) return ''
  return mdText
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, '$1• ')
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .trim()
}

/**
 * Convierte tokens de Markdown en párrafos de DOCX
 */
function tokensToDocxChildren(tokens) {
  const children = []
  let inBlockquote = false
  let inList = false
  let listType = null // 'bullet' | 'ordered'
  let orderedIndex = 1

  function inlineToTextRuns(inlineTokens) {
    const runs = []
    let isBold = false
    let isItalic = false
    let currentLink = null

    for (const token of inlineTokens) {
      if (token.type === 'strong_open') isBold = true
      else if (token.type === 'strong_close') isBold = false
      else if (token.type === 'em_open') isItalic = true
      else if (token.type === 'em_close') isItalic = false
      else if (token.type === 'link_open') {
        const href = token.attrs?.find((a) => a[0] === 'href')?.[1]
        currentLink = href
      } else if (token.type === 'link_close') {
        currentLink = null
      } else if (token.type === 'code_inline') {
        runs.push(
          new TextRun({
            text: token.content,
            font: 'Courier New',
            shading: { fill: 'F0EFEA' }
          })
        )
      } else if (token.type === 'text') {
        if (currentLink) {
          runs.push(
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: token.content,
                  bold: isBold,
                  italics: isItalic,
                  underline: {}
                })
              ],
              link: currentLink
            })
          )
        } else {
          runs.push(
            new TextRun({
              text: token.content,
              bold: isBold,
              italics: isItalic
            })
          )
        }
      }
    }
    return runs
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.replace('h', ''), 10)
      const next = tokens[++i]
      const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6
      }
      children.push(
        new Paragraph({
          children: inlineToTextRuns(next.children || []),
          heading: headingMap[level] || HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 }
        })
      )
      i++ // saltar heading_close
    } else if (token.type === 'paragraph_open') {
      const next = tokens[++i]
      const runs = inlineToTextRuns(next.children || [])
      const paraOptions = {
        children: runs,
        spacing: { before: 80, after: 120, line: 360 }
      }

      if (inBlockquote) {
        paraOptions.indent = { left: 720 }
        runs.forEach((r) => {
          if (r instanceof TextRun) r.italics = true
        })
      } else if (inList) {
        if (listType === 'bullet') {
          paraOptions.bullet = { level: 0 }
        } else if (listType === 'ordered') {
          runs.unshift(new TextRun({ text: `${orderedIndex++}. `, bold: true }))
        }
      }

      children.push(new Paragraph(paraOptions))
      i++ // saltar paragraph_close
    } else if (token.type === 'blockquote_open') {
      inBlockquote = true
    } else if (token.type === 'blockquote_close') {
      inBlockquote = false
    } else if (token.type === 'bullet_list_open') {
      inList = true
      listType = 'bullet'
    } else if (token.type === 'bullet_list_close') {
      inList = false
      listType = null
    } else if (token.type === 'ordered_list_open') {
      inList = true
      listType = 'ordered'
      orderedIndex = 1
    } else if (token.type === 'ordered_list_close') {
      inList = false
      listType = null
    } else if (token.type === 'fence' || token.type === 'code_block') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: token.content,
              font: 'Courier New',
              size: 20
            })
          ],
          spacing: { before: 140, after: 140 },
          shading: { fill: 'F6F5F0' }
        })
      )
    } else if (token.type === 'hr') {
      children.push(
        new Paragraph({
          thematicBreak: true,
          spacing: { before: 200, after: 200 }
        })
      )
    }
  }

  return children
}

/**
 * Convierte tokens de Markdown en XML de OpenDocument Text (ODT)
 */
function tokensToOdtXml(tokens) {
  let xml = ''
  let inBlockquote = false
  let inList = false

  function inlineToOdtXml(inlineTokens) {
    let result = ''
    let isBold = false
    let isItalic = false

    for (const token of inlineTokens) {
      if (token.type === 'strong_open') isBold = true
      else if (token.type === 'strong_close') isBold = false
      else if (token.type === 'em_open') isItalic = true
      else if (token.type === 'em_close') isItalic = false
      else if (token.type === 'code_inline') {
        result += `<text:span text:style-name="Code">${escapeXml(token.content)}</text:span>`
      } else if (token.type === 'text') {
        let styleName = ''
        if (isBold && isItalic) styleName = 'BoldItalic'
        else if (isBold) styleName = 'Bold'
        else if (isItalic) styleName = 'Italic'

        if (styleName) {
          result += `<text:span text:style-name="${styleName}">${escapeXml(token.content)}</text:span>`
        } else {
          result += escapeXml(token.content)
        }
      }
    }
    return result
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.replace('h', ''), 10)
      const next = tokens[++i]
      const textContent = inlineToOdtXml(next.children || [])
      xml += `<text:h text:outline-level="${level}">${textContent}</text:h>`
      i++ // saltar heading_close
    } else if (token.type === 'paragraph_open') {
      const next = tokens[++i]
      const textContent = inlineToOdtXml(next.children || [])
      const style = inBlockquote ? 'Quotations' : 'Standard'
      if (inList) {
        xml += `<text:list-item><text:p text:style-name="${style}">${textContent}</text:p></text:list-item>`
      } else {
        xml += `<text:p text:style-name="${style}">${textContent}</text:p>`
      }
      i++ // saltar paragraph_close
    } else if (token.type === 'blockquote_open') {
      inBlockquote = true
    } else if (token.type === 'blockquote_close') {
      inBlockquote = false
    } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      inList = true
      xml += `<text:list>`
    } else if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      inList = false
      xml += `</text:list>`
    } else if (token.type === 'fence' || token.type === 'code_block') {
      xml += `<text:p text:style-name="CodeBlock">${escapeXml(token.content)}</text:p>`
    } else if (token.type === 'hr') {
      xml += `<text:p text:style-name="HorizontalLine"/>`
    }
  }

  return xml
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
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
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
    if (!content && filePath) {
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
      await fs.writeFile(destinationPath, content, 'utf-8')
    } else if (format === 'txt') {
      const plainText = markdownToPlainText(content)
      await fs.writeFile(destinationPath, plainText, 'utf-8')
    } else if (format === 'docx') {
      const tokens = md.parse(content, {})
      const docChildren = tokensToDocxChildren(tokens)
      const doc = new Document({
        title: effectiveTitle,
        sections: [
          {
            properties: {},
            children: docChildren
          }
        ]
      })
      const buffer = await Packer.toBuffer(doc)
      await fs.writeFile(destinationPath, buffer)
    } else if (format === 'odt') {
      const tokens = md.parse(content, {})
      const bodyXml = tokensToOdtXml(tokens)
      const buffer = await buildOdtBuffer(effectiveTitle, bodyXml)
      await fs.writeFile(destinationPath, buffer)
    }

    return {
      success: true,
      filePath: destinationPath,
      fileName: basename(destinationPath),
      format
    }
  } catch (error) {
    console.error(`Error al exportar a formato ${format}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}
