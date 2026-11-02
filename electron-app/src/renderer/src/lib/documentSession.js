// A session owns revisions and serializes every write, including Save As and transitions.
// It has no React/Electron dependencies so race conditions can be tested deterministically.
export class DocumentSession {
  constructor(doc, { api, saveDraft, removeDraft, onPersist = () => {} }) {
    this.state = {
      id: doc.id,
      filePath: doc.filePath || null,
      fileName: doc.fileName || 'documento.md',
      content: doc.content ?? '',
      revision: 0,
      persistedRevision: 0,
      status: 'saved',
      error: ''
    }
    this.api = api
    this.saveDraft = saveDraft
    this.removeDraft = removeDraft
    this.onPersist = onPersist
    this.listeners = new Set()
    this.pending = Promise.resolve()
  }

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.state
  get dirty() {
    return this.state.revision !== this.state.persistedRevision
  }

  publish(patch) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  change(content) {
    if (content === this.state.content) return
    this.publish({ content, revision: this.state.revision + 1, status: 'unsaved', error: '' })
  }

  save({ explicit = false, saveAs = false, trigger = 'auto' } = {}) {
    const operation = this.pending.then(async () => {
      const version = this.state
      this.publish({ status: 'saving', error: '' })
      try {
        let result
        if (!version.filePath && !explicit) {
          await this.saveDraft(version)
          result = { success: true, filePath: null, fileName: version.fileName }
        } else {
          const method = saveAs ? this.api?.saveFileAs : this.api?.saveFile
          if (!method) throw new Error('No está disponible el servicio de guardado')
          result = await method({
            content: version.content,
            filePath: version.filePath,
            defaultName: version.fileName
          })
        }
        if (result?.canceled) {
          this.publish({ status: this.dirty ? 'unsaved' : 'saved' })
          return false
        }
        if (!result?.success) throw new Error(result?.error || 'No se pudo guardar el documento')
        this.publish({
          filePath: result.filePath,
          fileName: result.fileName,
          persistedRevision: version.revision,
          status: this.state.revision === version.revision ? 'saved' : 'unsaved'
        })
        // Saving a new draft to a file must not erase a newer, unpersisted revision.
        if (result.filePath && !version.filePath && this.state.revision === version.revision)
          this.removeDraft(version.id)
        await this.onPersist({
          ...result,
          content: version.content,
          previousPath: version.filePath,
          trigger
        })
        return true
      } catch (error) {
        this.publish({ status: 'error', error: error.message })
        throw error
      }
    })
    this.pending = operation.catch(() => {})
    return operation
  }

  async flush() {
    await this.pending
    while (this.dirty) {
      if (!(await this.save())) return false
    }
    return true
  }

  setOnPersist(callback) {
    this.onPersist = callback
  }

  relocate(filePath, fileName) {
    this.publish({ filePath, fileName })
  }
}
