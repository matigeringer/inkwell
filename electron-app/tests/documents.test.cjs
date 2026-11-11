const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const MarkdownIt = require('markdown-it')
const { Packer, Document } = require('docx')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')
const load = require('./load.cjs')
const model = load('src/main/documentModel.js')
const md = new MarkdownIt()
const { computeSideBySideDiff } = load('src/renderer/src/lib/historyDiff.js')

test('DOCX and ODT preserve soft/hard breaks, nested formatting, lists, tables and links', async () => {
  const tokens = md.parse(
    'hola\nmundo  \notra línea\n\n1. primero\n   - **anidado**\n2. segundo\n\n[enlace](https://example.org) y ~~tachado~~\n\n| A | B |\n|---|---|\n| C | D |',
    {}
  )
  const odt = model.tokensToOdtXml(tokens)
  assert.match(odt, /hola mundo<text:line-break\/>otra línea/)
  assert.match(odt, /xlink:href="https:\/\/example.org"/)
  const document = new JSDOM(
    `<root xmlns:text="urn:text" xmlns:xlink="urn:xlink" xmlns:table="urn:table" xmlns:office="urn:office">${odt}</root>`,
    { contentType: 'text/xml' }
  ).window.document
  assert.equal(document.querySelectorAll('parsererror').length, 0)
  assert.equal(document.getElementsByTagName('table:table-cell').length, 4)
  const docx = model.tokensToDocx(tokens)
  const zip = await JSZip.loadAsync(
    await Packer.toBuffer(
      new Document({ numbering: docx.numbering, sections: [{ children: docx.children }] })
    )
  )
  const xml = await zip.file('word/document.xml').async('string')
  assert.match(xml, /hola/)
  assert.match(xml, /mundo/)
  assert.match(xml, /w:br/)
  assert.match(xml, /w:tbl/)
  assert.match(xml, /w:strike/)
  assert.equal(model.tokensToPlainText(md.parse('hola\nmundo', {})), 'hola mundo')
})

test('document exporters write complete DOCX and ODT packages from Markdown', async (t) => {
  const directory = await fs.mkdtemp('/tmp/inkwell-format-')
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  let destination
  const { exportDocument } = load('src/main/documentExporter.js', {
    electron: {
      BrowserWindow: { fromWebContents: () => ({}) },
      dialog: { showSaveDialog: async () => ({ canceled: false, filePath: destination }) }
    }
  })
  for (const format of ['docx', 'odt']) {
    destination = path.join(directory, `story.${format}`)
    const result = await exportDocument(
      { sender: {} },
      { format, content: '# A story\n\n1. First\n2. Second\n\n**The end**' }
    )
    assert.equal(result.success, true)
    const bytes = await fs.readFile(destination)
    const zip = await JSZip.loadAsync(bytes)
    const body = await zip
      .file(format === 'docx' ? 'word/document.xml' : 'content.xml')
      .async('string')
    assert.match(body, /First/)
    assert.match(body, /The end/)
    if (format === 'odt') {
      assert.equal(Object.keys(zip.files)[0], 'mimetype')
      assert.equal(
        await zip.file('mimetype').async('string'),
        'application/vnd.oasis.opendocument.text'
      )
      assert.match(await zip.file('meta.xml').async('string'), /<dc:title>A story<\/dc:title>/)
      const xml = new JSDOM(body, { contentType: 'text/xml' }).window.document
      assert.equal(xml.querySelectorAll('parsererror').length, 0)
    }
  }
})

test('large diffs preserve exact input without quadratic allocation', () => {
  const left = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n')
  for (const right of [left + '\nnew', 'different\n'.repeat(20000), 'prefix\n' + left]) {
    const result = computeSideBySideDiff(left, right)
    assert.equal(result.leftTokens.map((token) => token.text).join(''), left)
    assert.equal(result.rightTokens.map((token) => token.text).join(''), right)
  }
})

test('diffs reconstruct empty, reordered and random multiline documents', () => {
  const values = ['', 'a', 'a\n', 'a\nb', 'b\na', '\n\na', 'a\nb\nc', 'x\nb\nc', 'a\nb\nx']
  for (const left of values)
    for (const right of values) {
      const result = computeSideBySideDiff(left, right)
      assert.equal(result.leftTokens.map((token) => token.text).join(''), left)
      assert.equal(result.rightTokens.map((token) => token.text).join(''), right)
    }
})

test('unsupported rich-text syntax selects lossless source editing', () => {
  const { needsSourceEditor } = load('src/renderer/src/lib/markdownSupport.js')
  assert.equal(needsSourceEditor('![image](https://example.org/a.png)'), true)
  assert.equal(needsSourceEditor('| A |\n|---|\n| B |'), true)
  assert.equal(needsSourceEditor('<script>bad()</script>'), true)
  assert.equal(needsSourceEditor('```html\n<script>example()</script>\n```'), false)
})
