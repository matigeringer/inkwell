import { useEffect, useState } from 'react'
import { computeSideBySideDiff } from '../lib/historyDiff'

export default function useHistoryDiff(left, right, enabled) {
  const [completed, setCompleted] = useState(null)
  useEffect(() => {
    if (!enabled) return
    if (typeof Worker === 'undefined') {
      const timer = setTimeout(
        () => setCompleted({ left, right, result: computeSideBySideDiff(left, right) }),
        0
      )
      return () => clearTimeout(timer)
    }
    const worker = new Worker(new URL('../workers/historyDiff.worker.js', import.meta.url), {
      type: 'module'
    })
    worker.onmessage = ({ data }) => setCompleted(data)
    worker.postMessage({ left, right })
    return () => worker.terminate()
  }, [left, right, enabled])
  return enabled && completed?.left === left && completed?.right === right ? completed.result : null
}
