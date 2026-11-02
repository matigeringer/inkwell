import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'
import MarkdownIt from 'markdown-it'
import { randomUUID } from 'node:crypto'
import { atomicWrite } from './storage'
import { validateContent } from './fileService'

// Instancia configurada de Markdown-it con opciones de lectura editorial
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false
})

let cachedFontFacesCss = null

/**
 * Carga e incrusta las fuentes tipográficas locales (Newsreader e IBM Plex Mono) en Base64
 * para asegurar renderizado 100% fiel e independiente de conexión o fuentes del sistema.
 */
async function getFontFacesCss() {
  if (cachedFontFacesCss !== null) {
    return cachedFontFacesCss
  }

  try {
    const newsreaderNormalPath =
      require.resolve('@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2')
    const newsreaderItalicPath =
      require.resolve('@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2')
    const ibmPlexMonoPath =
      require.resolve('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2')

    const [normalBuf, italicBuf, monoBuf] = await Promise.all([
      fs.readFile(newsreaderNormalPath),
      fs.readFile(newsreaderItalicPath),
      fs.readFile(ibmPlexMonoPath)
    ])

    cachedFontFacesCss = `
      @font-face {
        font-family: 'Newsreader';
        font-style: normal;
        font-weight: 200 900;
        src: url('data:font/woff2;base64,${normalBuf.toString('base64')}') format('woff2');
      }
      @font-face {
        font-family: 'Newsreader';
        font-style: italic;
        font-weight: 200 900;
        src: url('data:font/woff2;base64,${italicBuf.toString('base64')}') format('woff2');
      }
      @font-face {
        font-family: 'IBM Plex Mono';
        font-style: normal;
        font-weight: 400;
        src: url('data:font/woff2;base64,${monoBuf.toString('base64')}') format('woff2');
      }
    `
  } catch (err) {
    console.warn('Fuentes locales no encontradas para incrustar, usando fuentes del sistema:', err)
    cachedFontFacesCss = ''
  }

  return cachedFontFacesCss
}

/**
 * Escapa caracteres HTML peligrosos
 */
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
 * Genera el documento HTML completo maquetado con estilo editorial de lectura (libro / imprenta)
 */
function generateEditorialReadingHtml({ title, bodyHtml, fontFacesCss, isEn }) {
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'es'}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'">
  <title>${escapeHtml(title)}</title>
  <style>
    ${fontFacesCss}

    @page {
      size: A4;
      margin: 25mm 22mm 25mm 22mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1a1a18;
      font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
      font-size: 11.5pt;
      line-height: 1.68;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    body {
      width: 100%;
    }

    .manuscript-body {
      width: 100%;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
      font-weight: 600;
      color: #111110;
      line-height: 1.3;
      page-break-after: avoid;
      break-after: avoid;
      break-inside: avoid;
    }

    h1 {
      font-size: 18pt;
      margin-top: 2.2rem;
      margin-bottom: 0.9rem;
      font-style: italic;
      letter-spacing: -0.01em;
    }

    h2 {
      font-size: 14pt;
      margin-top: 1.8rem;
      margin-bottom: 0.7rem;
    }

    h3 {
      font-size: 12pt;
      margin-top: 1.4rem;
      margin-bottom: 0.5rem;
    }

    h4, h5, h6 {
      font-size: 11pt;
      font-style: italic;
      margin-top: 1.2rem;
      margin-bottom: 0.4rem;
    }

    p {
      margin: 0 0 1.05em 0;
      text-align: justify;
      text-justify: inter-word;
      hyphens: auto;
      word-break: break-word;
      orphans: 3;
      widows: 3;
    }

    blockquote, .fountain-blockquote {
      margin: 1.5em 0;
      padding: 0.4em 0 0.4em 1.6em;
      border-left: 2px solid #8e8c84;
      font-style: italic;
      color: #31312e;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    blockquote p, .fountain-blockquote p {
      margin-bottom: 0.5em;
    }

    blockquote p:last-child, .fountain-blockquote p:last-child {
      margin-bottom: 0;
    }

    ul, ol, .fountain-bullet-list, .fountain-ordered-list {
      margin: 0 0 1.2em 0;
      padding-left: 1.8em;
    }

    li {
      margin-bottom: 0.35em;
      text-align: justify;
      text-justify: inter-word;
    }

    ul[data-type="taskList"], .fountain-task-list {
      list-style: none;
      padding-left: 0;
    }

    li[data-type="taskItem"], .fountain-task-item {
      display: flex;
      align-items: baseline;
      gap: 0.55em;
      margin-bottom: 0.35em;
    }

    li[data-type="taskItem"] input[type="checkbox"],
    .fountain-task-item input[type="checkbox"] {
      margin: 0;
      transform: translateY(0.1em);
    }

    hr, .fountain-hr {
      border: none;
      border-top: 1px solid #cfcec5;
      margin: 2.4em auto;
      width: 38%;
      page-break-after: avoid;
      break-after: avoid;
    }

    code {
      font-family: 'IBM Plex Mono', 'Courier New', Courier, monospace;
      font-size: 0.88em;
      background-color: #f3f2ec;
      padding: 0.15em 0.35em;
      border-radius: 2px;
      color: #1a1a18;
    }

    pre, .fountain-code-block {
      font-family: 'IBM Plex Mono', 'Courier New', Courier, monospace;
      font-size: 8.8pt;
      background-color: #f8f7f2;
      border: 1px solid #dddbd2;
      border-radius: 3px;
      padding: 1em 1.2em;
      margin: 1.4em 0;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-all;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
      color: inherit;
    }

    a, .fountain-link {
      color: #1a1a18;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.6em 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    th, td {
      border: 1px solid #dcdad3;
      padding: 0.5em 0.8em;
      text-align: left;
    }

    th {
      background-color: #f4f3ed;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="manuscript-body">
    ${bodyHtml}
  </div>
</body>
</html>`
}

/**
 * Exporta un documento de lectura a PDF de forma limpia, directa y con estilo editorial.
 */
export async function exportDocumentToPdf(event, data = {}, appLanguage = 'es') {
  let printWin = null

  try {
    const isEn = appLanguage === 'en'
    let { filePath, fileName, content, title } = data

    // Si no se proporcionó contenido ni HTML, leer desde el archivo en disco
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

    if (content == null) {
      return {
        success: false,
        error: isEn ? 'No content to export' : 'No hay contenido para exportar'
      }
    }

    validateContent(content)

    // Resolver el nombre del archivo y título del manuscrito
    const effectiveFileName = fileName || (filePath ? basename(filePath) : 'documento.md')
    const effectiveTitle = title || resolveDocumentTitle(content, effectiveFileName, isEn)

    // Determinar ruta de guardado sugerida (.pdf)
    const baseNameWithoutExt = effectiveFileName.replace(/\.[^/.]+$/, '')
    const defaultPdfName = `${baseNameWithoutExt}.pdf`
    let defaultSavePath = defaultPdfName

    if (filePath) {
      defaultSavePath = join(dirname(filePath), defaultPdfName)
    }

    // Diálogo nativo de guardado
    const win = BrowserWindow.fromWebContents(event.sender)
    const saveDialogResult = await dialog.showSaveDialog(win, {
      title: isEn ? 'Export reading document to PDF' : 'Exportar archivo de lectura a PDF',
      defaultPath: defaultSavePath,
      filters: [
        { name: 'PDF (*.pdf)', extensions: ['pdf'] },
        { name: isEn ? 'All files (*.*)' : 'Todos los archivos (*.*)', extensions: ['*'] }
      ]
    })

    if (saveDialogResult.canceled || !saveDialogResult.filePath) {
      return { canceled: true }
    }

    const destinationPdfPath = saveDialogResult.filePath

    // Obtener HTML del cuerpo: si viene de Tiptap usarlo, o renderizar el Markdown
    const bodyHtml = md.render(content)

    // Obtener CSS de fuentes locales incrustadas
    const fontFacesCss = await getFontFacesCss()

    // Ensamblar el documento completo
    const fullHtml = generateEditorialReadingHtml({
      title: effectiveTitle,
      bodyHtml,
      fontFacesCss,
      isEn
    })

    // Crear ventana auxiliar oculta para generar el PDF de forma aislada e inalterada
    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false,
        partition: `print-${randomUUID()}`
      }
    })

    printWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    printWin.webContents.on('will-navigate', (event) => event.preventDefault())
    printWin.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false)
    )
    printWin.webContents.session.setPermissionCheckHandler(() => false)
    printWin.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith('data:') && details.url !== 'about:blank' })
    })

    // Cargar el HTML en la ventana de impresión
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)

    // Pequeño retardo de seguridad para asegurar renderizado vectorial perfecto
    await new Promise((resolve) => setTimeout(resolve, 80))

    // Configuración editorial para Chromium printToPDF
    const pdfOptions = {
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-size: 8.2pt; width: 100%; text-align: center; color: #666666;">
          <span class="pageNumber"></span>
        </div>
      `,
      margins: {
        marginType: 'custom',
        top: 0.88,
        bottom: 0.88,
        left: 0.8,
        right: 0.8
      }
    }

    const pdfBuffer = await printWin.webContents.printToPDF(pdfOptions)

    // Escribir el archivo PDF en disco
    await atomicWrite(destinationPdfPath, pdfBuffer)

    return {
      success: true,
      filePath: destinationPdfPath,
      fileName: basename(destinationPdfPath)
    }
  } catch (error) {
    console.error('Error al exportar documento a PDF:', error)
    return {
      success: false,
      error: error.message
    }
  } finally {
    if (printWin && !printWin.isDestroyed()) {
      printWin.destroy()
    }
  }
}
