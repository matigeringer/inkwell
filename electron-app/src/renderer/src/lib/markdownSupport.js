import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: true })
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
