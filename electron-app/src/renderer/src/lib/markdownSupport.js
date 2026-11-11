import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: true })

function inlineText(tokens = []) {
  return tokens
    .map((token) => {
      if (token.type === 'text' || token.type === 'code_inline') return token.content
      if (token.type === 'softbreak' || token.type === 'hardbreak') return ' '
      if (token.type === 'image') return inlineText(token.children)
      return ''
    })
    .join('')
}

export function sourceHeadings(source) {
  const lineStarts = [0]
  for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1)) {
    lineStarts.push(index + 1)
  }

  const tokens = parser.parse(source, {})
  return tokens.flatMap((token, index) =>
    token.type === 'heading_open'
      ? [
          {
            from: lineStarts[token.map[0]],
            level: Number(token.tag.slice(1)),
            title: inlineText(tokens[index + 1].children)
          }
        ]
      : []
  )
}

// Preserve syntax the rich-text schema cannot represent by editing the source instead.
export function needsSourceEditor(content = '') {
  return parser
    .parse(content, {})
    .some(
      (token) =>
        ['table_open', 'html_block'].includes(token.type) ||
        token.children?.some((child) => ['image', 'html_inline'].includes(child.type))
    )
}
