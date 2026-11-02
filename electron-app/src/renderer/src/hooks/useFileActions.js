import { useCallback } from 'react'

export default function useFileActions({ runMutation, onItemRenamed, onItemDeleted } = {}) {
  const execute = useCallback(
    (operation) => (runMutation ? runMutation(operation) : operation()),
    [runMutation]
  )
  const renameItem = useCallback(
    (data) =>
      execute(async () => {
        const result = await window.api.renameItem(data)
        if (result?.success) await onItemRenamed?.(result)
        return result
      }),
    [execute, onItemRenamed]
  )
  const deleteItem = useCallback(
    (path) =>
      execute(async () => {
        const result = await window.api.deleteItem(path)
        if (result?.success) await onItemDeleted?.(result)
        return result
      }),
    [execute, onItemDeleted]
  )
  return { renameItem, deleteItem }
}
