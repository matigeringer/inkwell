// Compare word tokens with a bounded longest common subsequence matrix.
function diffWords(leftStr, rightStr) {
  if (leftStr === rightStr) {
    return {
      leftTokens: [{ text: leftStr, type: 'same' }],
      rightTokens: [{ text: rightStr, type: 'same' }]
    }
  }

  if (!leftStr) {
    return {
      leftTokens: [],
      rightTokens: rightStr ? [{ text: rightStr, type: 'added' }] : []
    }
  }

  if (!rightStr) {
    return {
      leftTokens: leftStr ? [{ text: leftStr, type: 'removed' }] : [],
      rightTokens: []
    }
  }

  if (leftStr.length + rightStr.length > 200000) {
    return {
      leftTokens: [{ text: leftStr, type: 'removed' }],
      rightTokens: [{ text: rightStr, type: 'added' }]
    }
  }

  const a = leftStr.split(/(\s+)/)
  const b = rightStr.split(/(\s+)/)

  // Fall back to the whole block when the word matrix would grow too large.
  if (a.length * b.length > 250000) {
    return {
      leftTokens: [{ text: leftStr, type: 'removed' }],
      rightTokens: [{ text: rightStr, type: 'added' }]
    }
  }

  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const leftRaw = []
  const rightRaw = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      leftRaw.push({ text: a[i], type: 'same' })
      rightRaw.push({ text: b[j], type: 'same' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      leftRaw.push({ text: a[i], type: 'removed' })
      i++
    } else {
      rightRaw.push({ text: b[j], type: 'added' })
      j++
    }
  }

  while (i < n) {
    leftRaw.push({ text: a[i], type: 'removed' })
    i++
  }

  while (j < m) {
    rightRaw.push({ text: b[j], type: 'added' })
    j++
  }

  const mergeTokens = (tokens) => {
    const merged = []
    for (const tok of tokens) {
      if (!tok.text) continue
      const prev = merged[merged.length - 1]
      if (prev && prev.type === tok.type) {
        prev.text += tok.text
      } else {
        merged.push({ ...tok })
      }
    }
    return merged
  }

  return {
    leftTokens: mergeTokens(leftRaw),
    rightTokens: mergeTokens(rightRaw)
  }
}

export function computeSideBySideDiff(leftText = '', rightText = '') {
  const left = leftText.replace(/\r\n/g, '\n')
  const right = rightText.replace(/\r\n/g, '\n')
  if (left === right) {
    const tokens = left ? [{ text: left, type: 'same' }] : []
    return { hasChanges: false, leftTokens: tokens, rightTokens: tokens }
  }
  // Keep delimiters attached to each line so every result reconstructs the input.
  const lines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) || []
  const a = lines(left)
  const b = lines(right)
  let prefix = 0
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (suffix < Math.min(a.length, b.length) - prefix && a.at(-1 - suffix) === b.at(-1 - suffix))
    suffix++
  const middleA = a.slice(prefix, a.length - suffix)
  const middleB = b.slice(prefix, b.length - suffix)
  const leftTokens = []
  const rightTokens = []
  const append = (target, text, type) => {
    if (!text) return
    if (target.at(-1)?.type === type) target.at(-1).text += text
    else target.push({ text, type })
  }
  const same = (text) => {
    append(leftTokens, text, 'same')
    append(rightTokens, text, 'same')
  }
  const changed = (before, after) => {
    const diff = diffWords(before, after)
    diff.leftTokens.forEach((token) => append(leftTokens, token.text, token.type))
    diff.rightTokens.forEach((token) => append(rightTokens, token.text, token.type))
  }
  same(a.slice(0, prefix).join(''))
  const n = middleA.length
  const m = middleB.length
  if ((n + 1) * (m + 1) > 250000) {
    append(leftTokens, middleA.join(''), 'removed')
    append(rightTokens, middleB.join(''), 'added')
  } else {
    // A single bounded matrix avoids allocating a separate object for every line.
    const width = m + 1
    const dp = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) {
        dp[i * width + j] =
          middleA[i] === middleB[j]
            ? dp[(i + 1) * width + j + 1] + 1
            : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
      }
    let i = 0
    let j = 0
    let removed = ''
    let added = ''
    const flush = () => {
      changed(removed, added)
      removed = ''
      added = ''
    }
    while (i < n || j < m) {
      if (i < n && j < m && middleA[i] === middleB[j]) {
        flush()
        same(middleA[i])
        i++
        j++
      } else if (i < n && (j === m || dp[(i + 1) * width + j] >= dp[i * width + j + 1]))
        removed += middleA[i++]
      else added += middleB[j++]
    }
    flush()
  }
  same(a.slice(a.length - suffix).join(''))
  return { hasChanges: true, leftTokens, rightTokens }
}
