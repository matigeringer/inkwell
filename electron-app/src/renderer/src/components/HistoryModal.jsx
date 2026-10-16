import { useState, useEffect, useRef, useMemo } from 'react'
import {
  CloseIcon,
  HistoryIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  ArrowLeftIcon,
  ColumnsIcon,
  BookOpenIcon,
  ChevronDownIcon
} from './Icons'
import { getTranslation } from '../i18n'

/**
 * Calcula las diferencias por palabras dentro de un bloque de texto
 * usando Longest Common Subsequence (LCS) sobre tokens.
 */
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

  const a = leftStr.split(/(\s+)/)
  const b = rightStr.split(/(\s+)/)

  // Si el bloque es demasiado largo, marcar el párrafo completo para mantener fluidez instantánea
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

/**
 * Compara dos documentos completos línea por línea y refina por palabras
 * en los párrafos modificados para la vista "Lado a lado".
 */
function computeSideBySideDiff(leftText = '', rightText = '') {
  const normLeft = leftText.replace(/\r\n/g, '\n')
  const normRight = rightText.replace(/\r\n/g, '\n')

  if (normLeft === normRight) {
    return {
      hasChanges: false,
      leftTokens: normLeft ? [{ text: normLeft, type: 'same' }] : [],
      rightTokens: normRight ? [{ text: normRight, type: 'same' }] : []
    }
  }

  const leftLines = normLeft.split('\n')
  const rightLines = normRight.split('\n')
  const n = leftLines.length
  const m = rightLines.length

  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (leftLines[i] === rightLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const leftResult = []
  const rightResult = []
  let i = 0
  let j = 0

  const pushTokens = (target, tokens, addNewline) => {
    for (const t of tokens) {
      target.push(t)
    }
    if (addNewline) {
      target.push({ text: '\n', type: 'same' })
    }
  }

  while (i < n || j < m) {
    if (i < n && j < m && leftLines[i] === rightLines[j]) {
      pushTokens(leftResult, [{ text: leftLines[i], type: 'same' }], i < n - 1)
      pushTokens(rightResult, [{ text: rightLines[j], type: 'same' }], j < m - 1)
      i++
      j++
    } else {
      const removedChunk = []
      const addedChunk = []

      while (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
        if (j < m && leftLines[i] === rightLines[j]) break
        removedChunk.push({ line: leftLines[i], isLast: i === n - 1 })
        i++
      }

      while (j < m && (i >= n || dp[i][j + 1] > dp[i + 1][j])) {
        if (i < n && leftLines[i] === rightLines[j]) break
        addedChunk.push({ line: rightLines[j], isLast: j === m - 1 })
        j++
      }

      const pairCount = Math.max(removedChunk.length, addedChunk.length)
      for (let k = 0; k < pairCount; k++) {
        const rem = removedChunk[k]
        const add = addedChunk[k]

        if (rem && add) {
          const { leftTokens, rightTokens } = diffWords(rem.line, add.line)
          pushTokens(leftResult, leftTokens, !rem.isLast)
          pushTokens(rightResult, rightTokens, !add.isLast)
        } else if (rem) {
          pushTokens(leftResult, [{ text: rem.line, type: 'removed' }], !rem.isLast)
        } else if (add) {
          pushTokens(rightResult, [{ text: add.line, type: 'added' }], !add.isLast)
        }
      }
    }
  }

  return {
    hasChanges: true,
    leftTokens: leftResult,
    rightTokens: rightResult
  }
}

function countWords(text = '') {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
}

export default function HistoryModal({
  isOpen,
  onClose,
  docKey,
  currentContent = '',
  onRestoreVersion,
  preferences,
  showToast
}) {
  const [snapshots, setSnapshots] = useState([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  const [viewMode, setViewMode] = useState('reading') // 'reading' | 'compare'
  const [compareTargetId, setCompareTargetId] = useState('current') // 'current' | snapshotId
  const [compareTargetContent, setCompareTargetContent] = useState('')
  const [isCompareDropdownOpen, setIsCompareDropdownOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const compareDropdownRef = useRef(null)
  const leftPaneRef = useRef(null)
  const rightPaneRef = useRef(null)
  const isSyncingScrollRef = useRef(null)

  const currentLang = preferences?.language || 'es'
  const t = getTranslation(currentLang)

  const effectiveCompareTargetId =
    compareTargetId !== 'current' &&
    compareTargetId !== selectedSnapshotId &&
    snapshots.some((s) => s.id === compareTargetId)
      ? compareTargetId
      : 'current'

  // Cerrar el desplegable de comparación al hacer clic fuera
  useEffect(() => {
    if (!isCompareDropdownOpen) return
    const handleClickOutside = (e) => {
      if (compareDropdownRef.current && !compareDropdownRef.current.contains(e.target)) {
        setIsCompareDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isCompareDropdownOpen])

  // Cargar snapshots del documento al abrir
  useEffect(() => {
    if (!isOpen || !docKey || !window.api?.historyGetSnapshots) {
      return
    }

    let isMounted = true

    window.api
      .historyGetSnapshots(docKey)
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && Array.isArray(res.snapshots)) {
          setSnapshots(res.snapshots)
          if (res.snapshots.length > 0) {
            setSelectedSnapshotId((prev) => {
              const exists = res.snapshots.some((s) => s.id === prev)
              return exists ? prev : res.snapshots[0].id
            })
          } else {
            setSelectedSnapshotId(null)
            setPreviewContent('')
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error al cargar snapshots:', err)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, docKey])

  // Cargar contenido de la snapshot seleccionada (columna izquierda / lectura)
  useEffect(() => {
    if (!isOpen || !docKey || !selectedSnapshotId || !window.api?.historyGetSnapshotContent) {
      return
    }

    let isMounted = true
    window.api
      .historyGetSnapshotContent({ docKey, snapshotId: selectedSnapshotId })
      .then((res) => {
        if (isMounted && res && res.success) {
          setPreviewContent(res.content || '')
        }
      })
      .catch((err) => {
        console.error('Error al cargar contenido de la snapshot:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, docKey, selectedSnapshotId])

  // Cargar contenido de la versión objetivo cuando se compara contra otra versión del historial
  useEffect(() => {
    if (
      !isOpen ||
      !docKey ||
      effectiveCompareTargetId === 'current' ||
      !window.api?.historyGetSnapshotContent
    ) {
      return
    }

    let isMounted = true
    window.api
      .historyGetSnapshotContent({ docKey, snapshotId: effectiveCompareTargetId })
      .then((res) => {
        if (isMounted && res && res.success) {
          setCompareTargetContent(res.content || '')
        }
      })
      .catch((err) => {
        console.error('Error al cargar versión a comparar:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, docKey, effectiveCompareTargetId])

  // Manejar tecla Escape y navegación con flechas
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isCompareDropdownOpen) {
          setIsCompareDropdownOpen(false)
        } else {
          onClose()
        }
        return
      }

      if (snapshots.length === 0 || isCompareDropdownOpen) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = snapshots.findIndex((s) => s.id === selectedSnapshotId)
        if (currentIndex === -1) return

        if (e.key === 'ArrowDown' && currentIndex < snapshots.length - 1) {
          setSelectedSnapshotId(snapshots[currentIndex + 1].id)
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          setSelectedSnapshotId(snapshots[currentIndex - 1].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, snapshots, selectedSnapshotId, isCompareDropdownOpen])

  const effectiveTargetContent =
    effectiveCompareTargetId === 'current' ? currentContent : compareTargetContent

  const diffResult = useMemo(() => {
    if (viewMode !== 'compare') return null
    return computeSideBySideDiff(previewContent, effectiveTargetContent)
  }, [viewMode, previewContent, effectiveTargetContent])

  if (!isOpen) return null

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) || null
  const targetSnapshot =
    effectiveCompareTargetId === 'current'
      ? null
      : snapshots.find((s) => s.id === effectiveCompareTargetId) || null

  // Formato de fecha conciso mostrando siempre la fecha y la hora
  const formatSnapshotDate = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const locale = currentLang === 'en' ? 'en-US' : 'es-ES'

    const timeStr = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    })

    const dateOptions = {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
    }

    const dateStr = date.toLocaleDateString(locale, dateOptions)

    return `${dateStr}, ${timeStr}`
  }

  // Sincronización de desplazamiento entre las dos columnas de comparación
  const handleSyncScroll = (source) => {
    const sourceEl = source === 'left' ? leftPaneRef.current : rightPaneRef.current
    const targetEl = source === 'left' ? rightPaneRef.current : leftPaneRef.current
    if (!sourceEl || !targetEl) return

    if (isSyncingScrollRef.current && isSyncingScrollRef.current !== source) {
      return
    }

    isSyncingScrollRef.current = source
    const sourceMax = sourceEl.scrollHeight - sourceEl.clientHeight
    const targetMax = targetEl.scrollHeight - targetEl.clientHeight

    if (sourceMax > 0 && targetMax > 0) {
      const ratio = sourceEl.scrollTop / sourceMax
      targetEl.scrollTop = ratio * targetMax
    }

    requestAnimationFrame(() => {
      if (isSyncingScrollRef.current === source) {
        isSyncingScrollRef.current = null
      }
    })
  }

  // Eliminar una snapshot específica
  const handleDeleteSnapshot = async (e, snapshotId) => {
    e.stopPropagation()
    if (!window.api?.historyDeleteSnapshot || !docKey) return

    try {
      const res = await window.api.historyDeleteSnapshot({ docKey, snapshotId })
      if (res && res.success) {
        setSnapshots((prev) => {
          const next = prev.filter((s) => s.id !== snapshotId)
          if (selectedSnapshotId === snapshotId) {
            setSelectedSnapshotId(next.length > 0 ? next[0].id : null)
          }
          if (compareTargetId === snapshotId) {
            setCompareTargetId('current')
          }
          return next
        })
        if (showToast) {
          showToast(t.history?.toastDeleted || 'Versión eliminada')
        }
      }
    } catch (err) {
      console.error('Error al eliminar snapshot:', err)
    }
  }

  // Copiar contenido de la versión al portapapeles
  const handleCopyContent = async () => {
    if (!previewContent) return
    try {
      await navigator.clipboard.writeText(previewContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      if (showToast) {
        showToast(t.history?.toastCopied || 'Contenido copiado al portapapeles')
      }
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err)
    }
  }

  // Restaurar la versión seleccionada
  const handleRestore = () => {
    if (!selectedSnapshot) return
    if (onRestoreVersion) {
      onRestoreVersion(previewContent, selectedSnapshot)
      onClose()
    }
  }

  const currentWords = countWords(currentContent)
  const snapshotWords = selectedSnapshot?.words ?? countWords(previewContent)
  const targetWords =
    effectiveCompareTargetId === 'current'
      ? currentWords
      : (targetSnapshot?.words ?? countWords(effectiveTargetContent))
  const deltaWords = snapshotWords - targetWords

  const editorFontStyle = {
    fontFamily:
      preferences?.fontFamily === 'sans'
        ? 'var(--font-ui)'
        : preferences?.fontFamily === 'mono'
          ? 'var(--font-mono)'
          : 'var(--font-serif)',
    fontSize: preferences?.fontSize === '1.80rem' ? '1.2rem' : '1.05rem',
    textAlign: preferences?.textAlign || 'left'
  }

  const compareTargetLabel =
    effectiveCompareTargetId === 'current'
      ? t.history.currentVersion
      : targetSnapshot
        ? formatSnapshotDate(targetSnapshot.timestamp)
        : t.history.currentVersion

  const otherSnapshots = snapshots.filter((s) => s.id !== selectedSnapshotId)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-wide history-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        {/* Cabecera estilo ProfileModal con pestañas segmentadas: Lectura primero, Lado a lado después */}
        <header className="modal-header-wide">
          <div className="modal-header-title-bar">
            <h2 id="history-modal-title" className="modal-title">
              {t.history.title}
            </h2>
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={onClose}
              aria-label={t.common.close}
              title={`${t.common.close} (Esc)`}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <nav className="modal-segmented-nav" aria-label={t.history.title}>
            <button
              type="button"
              className={`segmented-tab-btn ${viewMode === 'reading' ? 'is-active' : ''}`}
              onClick={() => setViewMode('reading')}
            >
              <BookOpenIcon size={15} />
              <span>{t.history.tabReading}</span>
            </button>
            <button
              type="button"
              className={`segmented-tab-btn ${viewMode === 'compare' ? 'is-active' : ''}`}
              onClick={() => setViewMode('compare')}
            >
              <ColumnsIcon size={15} />
              <span>{t.history.tabCompare}</span>
            </button>
          </nav>
        </header>

        <div className="history-modal-body">
          {/* Lista lateral minimalista: solo fecha/hora */}
          <aside className="history-timeline-panel">
            {snapshots.length === 0 ? (
              <div className="history-empty-state">
                <p>{t.history.emptyMessage}</p>
              </div>
            ) : (
              <div className="history-snapshot-list">
                {snapshots.map((item) => {
                  const isSelected = item.id === selectedSnapshotId
                  return (
                    <div
                      key={item.id}
                      className={`history-snapshot-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedSnapshotId(item.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="snapshot-item-main">
                        <span className="snapshot-item-time">
                          {formatSnapshotDate(item.timestamp)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-snapshot-delete"
                        onClick={(e) => handleDeleteSnapshot(e, item.id)}
                        title={t.common.delete}
                        aria-label={t.common.delete}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </aside>

          {/* Panel principal: Comparación Lado a Lado o Lectura limpia */}
          <main className="history-preview-panel">
            {selectedSnapshot ? (
              <>
                {/* Barra de herramientas sobria alineada con ProfileModal */}
                <div className="history-toolbar">
                  {viewMode === 'compare' ? (
                    <div className="history-compare-controls">
                      <span className="history-compare-label">{t.history.compareWith}</span>
                      <div
                        className="theme-dropdown-container history-compare-dropdown"
                        ref={compareDropdownRef}
                      >
                        <button
                          type="button"
                          className={`theme-dropdown-trigger ${isCompareDropdownOpen ? 'is-open' : ''}`}
                          onClick={() => setIsCompareDropdownOpen((prev) => !prev)}
                          aria-haspopup="listbox"
                          aria-expanded={isCompareDropdownOpen}
                        >
                          <span className="theme-trigger-name">{compareTargetLabel}</span>
                          <ChevronDownIcon
                            size={14}
                            className={`theme-dropdown-chevron ${isCompareDropdownOpen ? 'is-rotated' : ''}`}
                          />
                        </button>

                        {isCompareDropdownOpen && (
                          <div
                            className="theme-dropdown-menu history-dropdown-menu-left"
                            role="listbox"
                          >
                            <div className="theme-dropdown-list">
                              <button
                                type="button"
                                role="option"
                                aria-selected={effectiveCompareTargetId === 'current'}
                                className={`theme-dropdown-item ${effectiveCompareTargetId === 'current' ? 'is-selected' : ''}`}
                                onClick={() => {
                                  setCompareTargetId('current')
                                  setIsCompareDropdownOpen(false)
                                }}
                              >
                                <div className="theme-item-details">
                                  <span className="theme-item-name">{t.history.currentVersion}</span>
                                  <span className="theme-item-desc">
                                    {t.history.currentVersionDesc} · {currentWords}{' '}
                                    {t.history.wordsShort}
                                  </span>
                                </div>
                                <span className="theme-item-check">
                                  {effectiveCompareTargetId === 'current' && <CheckIcon size={14} />}
                                </span>
                              </button>

                              {otherSnapshots.map((snap) => {
                                const isTarget = effectiveCompareTargetId === snap.id
                                return (
                                  <button
                                    key={snap.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isTarget}
                                    className={`theme-dropdown-item ${isTarget ? 'is-selected' : ''}`}
                                    onClick={() => {
                                      setCompareTargetId(snap.id)
                                      setIsCompareDropdownOpen(false)
                                    }}
                                  >
                                    <div className="theme-item-details">
                                      <span className="theme-item-name">
                                        {formatSnapshotDate(snap.timestamp)}
                                      </span>
                                      <span className="theme-item-desc">
                                        {snap.words} {t.history.wordsShort}
                                      </span>
                                    </div>
                                    <span className="theme-item-check">
                                      {isTarget && <CheckIcon size={14} />}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="history-reading-meta">
                      <span className="history-reading-date">
                        {formatSnapshotDate(selectedSnapshot.timestamp)}
                      </span>
                    </div>
                  )}

                  <div className="history-preview-actions">
                    <button
                      type="button"
                      className="btn-sober-secondary btn-history-action"
                      onClick={handleCopyContent}
                      title={t.history.copyTitle}
                    >
                      {isCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      <span>{isCopied ? t.history.copied : t.history.copy}</span>
                    </button>

                    <button
                      type="button"
                      className="btn-sober-primary btn-history-action"
                      onClick={handleRestore}
                      title={t.history.restoreTitle}
                    >
                      <ArrowLeftIcon size={14} />
                      <span>{t.history.restore}</span>
                    </button>
                  </div>
                </div>

                {/* Contenido principal según la pestaña activa */}
                {viewMode === 'compare' ? (
                  <div className="history-compare-grid">
                    {/* Columna Izquierda: Versión seleccionada */}
                    <section className="history-compare-col">
                      <header className="history-col-header">
                        <span className="history-col-title">
                          {formatSnapshotDate(selectedSnapshot.timestamp)}
                        </span>
                        <div className="history-col-meta">
                          <span>
                            {snapshotWords} {t.history.wordsShort}
                          </span>
                          {deltaWords !== 0 ? (
                            <span
                              className={`snapshot-delta-pill ${deltaWords > 0 ? 'delta-positive' : 'delta-negative'}`}
                            >
                              {deltaWords > 0 ? `+${deltaWords}` : deltaWords}
                            </span>
                          ) : (
                            !diffResult?.hasChanges && (
                              <span className="snapshot-delta-pill delta-neutral">
                                {t.history.noChanges}
                              </span>
                            )
                          )}
                        </div>
                      </header>

                      <div
                        className="history-col-body"
                        ref={leftPaneRef}
                        onScroll={() => handleSyncScroll('left')}
                      >
                        <div className="history-preview-text" style={editorFontStyle}>
                          {diffResult?.leftTokens?.length > 0 ? (
                            diffResult.leftTokens.map((tok, idx) =>
                              tok.type === 'removed' ? (
                                <mark key={idx} className="diff-token-removed">
                                  {tok.text}
                                </mark>
                              ) : (
                                <span key={idx}>{tok.text}</span>
                              )
                            )
                          ) : (
                            <span className="history-empty-text">{t.history.emptyDocument}</span>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Columna Derecha: Versión a comparar (Actual u otra snapshot) */}
                    <section className="history-compare-col">
                      <header className="history-col-header">
                        <span className="history-col-title">{compareTargetLabel}</span>
                        <div className="history-col-meta">
                          <span>
                            {targetWords} {t.history.wordsShort}
                          </span>
                        </div>
                      </header>

                      <div
                        className="history-col-body"
                        ref={rightPaneRef}
                        onScroll={() => handleSyncScroll('right')}
                      >
                        <div className="history-preview-text" style={editorFontStyle}>
                          {diffResult?.rightTokens?.length > 0 ? (
                            diffResult.rightTokens.map((tok, idx) =>
                              tok.type === 'added' ? (
                                <mark key={idx} className="diff-token-added">
                                  {tok.text}
                                </mark>
                              ) : (
                                <span key={idx}>{tok.text}</span>
                              )
                            )
                          ) : (
                            <span className="history-empty-text">{t.history.emptyDocument}</span>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="history-preview-surface">
                    <div
                      className="history-preview-text"
                      style={{
                        ...editorFontStyle,
                        fontSize: preferences?.fontSize || '1.40rem'
                      }}
                    >
                      {previewContent ? (
                        previewContent
                      ) : (
                        <span className="history-empty-text">{t.history.emptyDocument}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="history-no-selection">
                <HistoryIcon size={28} className="history-no-sel-icon" />
                <p>
                  {snapshots.length > 0
                    ? t.history.selectVersionPrompt
                    : t.history.noVersionsPrompt}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
