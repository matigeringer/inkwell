import { computeSideBySideDiff } from '../lib/historyDiff'

self.onmessage = ({ data }) => {
  self.postMessage({
    left: data.left,
    right: data.right,
    result: computeSideBySideDiff(data.left, data.right)
  })
}
