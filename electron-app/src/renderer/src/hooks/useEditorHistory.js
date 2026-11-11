import { useCallback, useRef } from 'react'
import { countWords } from '../../../shared/textStats'

export default function useEditorHistory({ draftKey, enabled, interval, maxEntries, showToast }) {
  const lastSnapshot = useRef({ timestamp: 0, words: 0 })

  const saveSnapshot = useCallback(
    async ({ content, filePath, fileName, trigger }) => {
      if (!enabled || !window.api?.historySaveSnapshot) return
      const words = countWords(content)
      if (
        trigger === 'auto' &&
        Date.now() - lastSnapshot.current.timestamp < interval &&
        Math.abs(words - lastSnapshot.current.words) < 25
      ) {
        return
      }

      const result = await window.api.historySaveSnapshot({
        docKey: filePath || draftKey,
        docName: fileName,
        filePath,
        content,
        trigger,
        words,
        characters: content.length,
        maxEntries
      })
      if (!result?.success) throw new Error(result?.error || 'No se pudo guardar el historial')
      if (!result.duplicate) lastSnapshot.current = { timestamp: Date.now(), words }
    },
    [draftKey, enabled, interval, maxEntries]
  )

  const moveHistory = useCallback(
    async ({ fromKey, toKey, fileName, filePath }) => {
      if (fromKey === toKey || !window.api?.historyMove) return
      try {
        const result = await window.api.historyMove({ fromKey, toKey, docName: fileName, filePath })
        if (!result?.success) throw new Error(result?.error || 'No se pudo trasladar el historial')
      } catch (error) {
        showToast(error.message, 'error')
      }
    },
    [showToast]
  )

  const recordPersisted = useCallback(
    async ({ content, filePath, fileName, previousPath, trigger }) => {
      if (filePath) {
        await moveHistory({
          fromKey: previousPath || draftKey,
          toKey: filePath,
          fileName,
          filePath
        })
      }
      await saveSnapshot({ content, filePath, fileName, trigger })
    },
    [draftKey, moveHistory, saveSnapshot]
  )

  return { saveSnapshot, moveHistory, recordPersisted }
}
