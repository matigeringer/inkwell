export function isTrustedSender(event, windows, expectedUrl) {
  if (!event.senderFrame || !windows.has(event.sender)) return false
  if (event.senderFrame !== event.sender.mainFrame) return false
  try {
    const actual = new URL(event.senderFrame.url)
    const expected = new URL(expectedUrl)
    actual.hash = ''
    expected.hash = ''
    return actual.href === expected.href
  } catch {
    return false
  }
}

export function isSafeExternalUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
