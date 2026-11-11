import { basename } from 'node:path'
import { Document, Packer } from 'docx'
import { atomicWrite } from './storage'
import { chooseExportPath, exportMarkdown, getExportSource } from './exportSource'
import {
  escapeXml,
  tokensToDocx,
  tokensToOdtXml,
  tokensToPlainText,
  exportWarnings
} from './documentModel'
import JSZip from 'jszip'
import { exportDocumentToPdf } from './pdfExporter'

async function buildOdtBuffer(title, bodyXml) {
  const zip = new JSZip()

  // ODT readers expect the mimetype entry first and uncompressed.
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`
  zip.file('META-INF/manifest.xml', manifestXml)

  const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <dc:title>${escapeXml(title)}</dc:title>
  </office:meta>
</office:document-meta>`
  zip.file('meta.xml', metaXml)

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

  const listStyles = ['ListBullet', 'ListNumber']
    .map((name) => {
      const levels = Array.from({ length: 10 }, (_, index) => {
        const level = index + 1
        return name === 'ListNumber'
          ? `<text:list-level-style-number text:level="${level}" style:num-format="1" style:num-suffix="."/>`
          : `<text:list-level-style-bullet text:level="${level}" text:bullet-char="•"/>`
      })
      return `<text:list-style style:name="${name}">${levels.join('')}</text:list-style>`
    })
    .join('')

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2">
  <office:automatic-styles>
    ${listStyles}
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

export async function exportDocument(event, data = {}, appLanguage = 'es') {
  const isEn = appLanguage === 'en'
  const format = (data.format || 'pdf').toLowerCase()

  if (format === 'pdf') {
    return exportDocumentToPdf(event, data, appLanguage)
  }

  try {
    const source = getExportSource(data, isEn)
    const tokens = exportMarkdown.parse(source.content, {})
    const warnings = exportWarnings(tokens)

    const formatConfigs = {
      markdown: {
        ext: 'md',
        filter: {
          name: 'Markdown (*.md)',
          extensions: ['md', 'markdown']
        },
        title: isEn ? 'Export to Markdown' : 'Exportar a Markdown'
      },
      txt: {
        ext: 'txt',
        filter: { name: isEn ? 'Plain text (*.txt)' : 'Texto plano (*.txt)', extensions: ['txt'] },
        title: isEn ? 'Export to plain text' : 'Exportar a texto plano'
      },
      docx: {
        ext: 'docx',
        filter: {
          name: isEn ? 'Word Document (*.docx)' : 'Documento de Word (*.docx)',
          extensions: ['docx']
        },
        title: isEn ? 'Export to Microsoft Word' : 'Exportar a Microsoft Word (.docx)'
      },
      odt: {
        ext: 'odt',
        filter: {
          name: isEn ? 'OpenDocument Text (*.odt)' : 'Documento LibreOffice / OpenDocument (*.odt)',
          extensions: ['odt']
        },
        title: isEn
          ? 'Export to OpenDocument (LibreOffice)'
          : 'Exportar a OpenDocument / LibreOffice (.odt)'
      }
    }

    if (!Object.hasOwn(formatConfigs, format)) {
      return {
        success: false,
        error: isEn ? `Unsupported format: ${format}` : `Formato no soportado: ${format}`
      }
    }

    const destinationPath = await chooseExportPath(
      event.sender,
      source,
      formatConfigs[format],
      isEn
    )
    if (!destinationPath) return { canceled: true }

    let output
    switch (format) {
      case 'markdown':
        output = source.content
        break
      case 'txt':
        output = tokensToPlainText(tokens)
        break
      case 'docx': {
        const { children, numbering } = tokensToDocx(tokens)
        const doc = new Document({ title: source.title, numbering, sections: [{ children }] })
        output = await Packer.toBuffer(doc)
        break
      }
      case 'odt':
        output = await buildOdtBuffer(source.title, tokensToOdtXml(tokens))
        break
    }
    await atomicWrite(destinationPath, output)

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
