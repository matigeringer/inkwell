import {
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  LevelFormat
} from 'docx'

export function escapeXml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]
  )
}

export function inlineText(tokens = []) {
  return tokens
    .map((token) => {
      if (token.type === 'softbreak') return ' '
      if (token.type === 'hardbreak') return '\n'
      if (token.type === 'image') return `[${token.content}] (${token.attrGet('src')})`
      return ['text', 'code_inline', 'html_inline'].includes(token.type) ? token.content : ''
    })
    .join('')
}

export function tokensToPlainText(tokens) {
  return tokens
    .map((token) => {
      if (token.type === 'inline') return inlineText(token.children)
      if (['fence', 'code_block', 'html_block'].includes(token.type)) return token.content
      if (['paragraph_close', 'heading_close', 'tr_close'].includes(token.type)) return '\n'
      if (token.type === 'list_item_open') return '• '
      if (['td_close', 'th_close'].includes(token.type)) return '\t'
      return ''
    })
    .join('')
    .trimEnd()
}

function inlineDocx(tokens = []) {
  const runs = []
  const styles = { strong: 0, em: 0, s: 0 }
  let link = null
  for (const token of tokens) {
    const match = /^(strong|em|s)_(open|close)$/.exec(token.type)
    if (match) {
      styles[match[1]] += match[2] === 'open' ? 1 : -1
      continue
    }
    if (token.type === 'link_open') {
      link = token.attrGet('href')
      continue
    }
    if (token.type === 'link_close') {
      link = null
      continue
    }
    if (token.type === 'hardbreak') {
      runs.push(new TextRun({ break: 1 }))
      continue
    }
    const text = inlineText([token])
    if (!text) continue
    const run = new TextRun({
      text,
      bold: styles.strong > 0,
      italics: styles.em > 0,
      strike: styles.s > 0,
      ...(token.type === 'code_inline' ? { font: 'Courier New' } : {})
    })
    runs.push(link ? new ExternalHyperlink({ link, children: [run] }) : run)
  }
  return runs
}

export function tokensToDocx(tokens) {
  const children = []
  const lists = []
  const numbering = []
  let quoteDepth = 0
  let index = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (['bullet_list_open', 'ordered_list_open'].includes(token.type)) {
      const reference = `list-${index++}`
      lists.push({ reference, fresh: false })
      numbering.push({
        reference,
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format: token.type === 'ordered_list_open' ? LevelFormat.DECIMAL : LevelFormat.BULLET,
          text: token.type === 'ordered_list_open' ? `%${level + 1}.` : '•',
          start: Number(token.attrGet('start')) || 1,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 260 } } }
        }))
      })
    } else if (['bullet_list_close', 'ordered_list_close'].includes(token.type)) lists.pop()
    else if (token.type === 'list_item_open') lists.at(-1).fresh = true
    else if (token.type === 'blockquote_open') quoteDepth++
    else if (token.type === 'blockquote_close') quoteDepth--
    else if (token.type === 'table_open') {
      const rows = []
      let cells = []
      while (++i < tokens.length && tokens[i].type !== 'table_close') {
        if (tokens[i].type === 'tr_open') cells = []
        else if (tokens[i].type === 'inline')
          cells.push(
            new TableCell({
              children: [new Paragraph({ children: inlineDocx(tokens[i].children) })]
            })
          )
        else if (tokens[i].type === 'tr_close') rows.push(new TableRow({ children: cells }))
      }
      children.push(new Table({ rows }))
    } else if (['paragraph_open', 'heading_open'].includes(token.type)) {
      const list = lists.at(-1)
      const options = { children: inlineDocx(tokens[++i]?.children), spacing: { after: 120 } }
      if (token.type === 'heading_open')
        options.heading = HeadingLevel[`HEADING_${token.tag.slice(1)}`]
      if (quoteDepth) options.indent = { left: 720 * quoteDepth }
      if (list?.fresh) {
        options.numbering = { reference: list.reference, level: Math.min(lists.length - 1, 8) }
        list.fresh = false
      }
      children.push(new Paragraph(options))
    } else if (['fence', 'code_block', 'html_block'].includes(token.type)) {
      const runs = token.content
        .replace(/\n$/, '')
        .split('\n')
        .flatMap((text, line) => [
          ...(line ? [new TextRun({ break: 1 })] : []),
          new TextRun({ text, font: 'Courier New' })
        ])
      children.push(new Paragraph({ children: runs }))
    } else if (token.type === 'hr') children.push(new Paragraph({ thematicBreak: true }))
  }
  return {
    children: children.length ? children : [new Paragraph('')],
    numbering: { config: numbering }
  }
}

function odtText(value) {
  return escapeXml(value).replace(/ {2,}/g, (spaces) => `<text:s text:c="${spaces.length}"/>`)
}

function inlineOdt(tokens = []) {
  return tokens
    .map((token) => {
      if (token.type === 'strong_open') return '<text:span text:style-name="Bold">'
      if (token.type === 'em_open') return '<text:span text:style-name="Italic">'
      if (token.type === 's_open') return '<text:span text:style-name="Strike">'
      if (['strong_close', 'em_close', 's_close'].includes(token.type)) return '</text:span>'
      if (token.type === 'link_open')
        return `<text:a xlink:type="simple" xlink:href="${escapeXml(token.attrGet('href'))}">`
      if (token.type === 'link_close') return '</text:a>'
      if (token.type === 'hardbreak') return '<text:line-break/>'
      if (token.type === 'code_inline')
        return `<text:span text:style-name="Code">${odtText(token.content)}</text:span>`
      return odtText(inlineText([token]))
    })
    .join('')
}

export function tokensToOdtXml(tokens) {
  let xml = ''
  let quotes = 0
  for (const token of tokens) {
    if (token.type === 'inline') xml += inlineOdt(token.children)
    else if (token.type === 'heading_open')
      xml += `<text:h text:outline-level="${token.tag.slice(1)}">`
    else if (token.type === 'heading_close') xml += '</text:h>'
    else if (token.type === 'paragraph_open')
      xml += `<text:p text:style-name="${quotes ? 'Quotations' : 'Standard'}">`
    else if (token.type === 'paragraph_close') xml += '</text:p>'
    else if (token.type === 'blockquote_open') quotes++
    else if (token.type === 'blockquote_close') quotes--
    else if (['bullet_list_open', 'ordered_list_open'].includes(token.type)) {
      xml += `<text:list text:style-name="${token.type === 'ordered_list_open' ? 'ListNumber' : 'ListBullet'}">`
    } else if (['bullet_list_close', 'ordered_list_close'].includes(token.type))
      xml += '</text:list>'
    else if (token.type === 'list_item_open') xml += '<text:list-item>'
    else if (token.type === 'list_item_close') xml += '</text:list-item>'
    else if (token.type === 'table_open') xml += '<table:table>'
    else if (token.type === 'table_close') xml += '</table:table>'
    else if (token.type === 'tr_open') xml += '<table:table-row>'
    else if (token.type === 'tr_close') xml += '</table:table-row>'
    else if (['td_open', 'th_open'].includes(token.type))
      xml += '<table:table-cell office:value-type="string"><text:p>'
    else if (['td_close', 'th_close'].includes(token.type)) xml += '</text:p></table:table-cell>'
    else if (['fence', 'code_block', 'html_block'].includes(token.type)) {
      xml += `<text:p text:style-name="CodeBlock">${token.content.replace(/\n$/, '').split('\n').map(odtText).join('<text:line-break/>')}</text:p>`
    } else if (token.type === 'hr') xml += '<text:p>────────</text:p>'
  }
  return xml
}

export function exportWarnings(tokens) {
  return tokens.some((token) => token.children?.some((child) => child.type === 'image'))
    ? [
        'Las imágenes se exportan como descripción y enlace / Images are exported as descriptions and links'
      ]
    : []
}
