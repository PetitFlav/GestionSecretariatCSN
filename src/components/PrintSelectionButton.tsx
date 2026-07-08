'use client'

/**
 * components/PrintSelectionButton.tsx
 *
 * Bouton "🖨 Imprimer (N)" pour la liste adhérents.
 *
 * Comportement :
 *   - Agent dispo  → impression directe → toast ✓
 *   - Agent absent → télécharge les PNG un par un + ouvre modal preview
 *   - Déjà imprimés → skippés, info affichée
 */

import { useState, useEffect } from 'react'

interface PrintResult {
  ok: boolean
  mode?: string
  printed?: number
  simulated?: number
  skipped?: number
  skippedNames?: string[]
  errors?: string[]
  message?: string
  labels?: Array<{ adherentId: string; nom: string; prenom: string; filename: string; pngBase64: string }>
}

interface Props {
  selectedIds: string[]
  onDone?: (result: PrintResult) => void
  force?: boolean
}

// ─── Modal résultat / preview ─────────────────────────────────────────────────
function ResultModal({
  result,
  onClose,
}: {
  result: PrintResult
  onClose: () => void
}) {
  const isDownload = result.mode === 'fallback-download' || result.mode === 'simulate'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--csn-border)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            {result.ok ? '✅ Impression terminée' : '⚠️ Résultat impression'}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {/* Corps */}
        <div className="px-4 py-4 flex flex-col gap-3">

          {/* Mode agent */}
          {result.mode === 'agent' && (
            <div className="text-[13px] text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
              🖨️ {result.printed} étiquette{(result.printed ?? 0) > 1 ? 's' : ''} envoyée{(result.printed ?? 0) > 1 ? 's' : ''} à l'imprimante.
            </div>
          )}

          {/* Mode download */}
          {isDownload && result.labels && result.labels.length > 0 && (
            <div className="text-[13px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
              📥 Agent non disponible — {result.labels.length} PNG téléchargé{result.labels.length > 1 ? 's' : ''}.
            </div>
          )}

          {/* Préview des étiquettes téléchargées */}
          {isDownload && result.labels && result.labels.length > 0 && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {result.labels.map(label => (
                <div key={label.adherentId}
                  className="flex items-center gap-3 p-2 rounded-lg border"
                  style={{ borderColor: 'var(--csn-border)' }}>
                  <img
                    src={`data:image/png;base64,${label.pngBase64}`}
                    alt={`Étiquette ${label.nom}`}
                    className="h-12 rounded border"
                    style={{ borderColor: 'var(--csn-border)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: 'var(--csn-navy)' }}>
                      {label.nom} {label.prenom}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{label.filename}</div>
                  </div>
                  <a
                    href={`data:image/png;base64,${label.pngBase64}`}
                    download={label.filename}
                    className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50 transition-colors flex-shrink-0"
                    style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}
                  >
                    ↓
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Skippés */}
          {(result.skipped ?? 0) > 0 && (
            <div className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              ⏭ {result.skipped} déjà imprimé{(result.skipped ?? 0) > 1 ? 's' : ''} — ignoré{(result.skipped ?? 0) > 1 ? 's' : ''}.
              {result.skippedNames && result.skippedNames.length > 0 && (
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  {result.skippedNames.join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Erreurs */}
          {result.errors && result.errors.length > 0 && (
            <div className="text-[12px] text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {result.errors.map((e, i) => <div key={i}>✗ {e}</div>)}
            </div>
          )}

          {/* Message custom */}
          {result.message && (
            <div className="text-[12px] text-slate-500">{result.message}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end"
          style={{ borderColor: 'var(--csn-border)', background: 'var(--csn-cream)' }}>
          <button onClick={onClose}
            className="text-[12px] px-4 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--csn-navy)' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PrintSelectionButton ─────────────────────────────────────────────────────
export function PrintSelectionButton({ selectedIds, onDone, force = false }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null)
  const [result, setResult] = useState<PrintResult | null>(null)

  // Ping agent au montage
  useEffect(() => {
    fetch('/api/print', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setAgentAvailable(d.agentAvailable ?? false))
      .catch(() => setAgentAvailable(false))
  }, [])

  async function handlePrint() {
    if (selectedIds.length === 0) return
    setStatus('loading')

    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adherentIds: selectedIds, force }),
      })

      const contentType = res.headers.get('content-type') ?? ''

      // PNG binaire direct (1 seul adhérent, fallback)
      if (contentType.includes('image/png')) {
        const blob = await res.blob()
        const filename =
          res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'label.png'
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        const r: PrintResult = { ok: true, mode: 'fallback-download', printed: 0, simulated: 1 }
        setResult(r)
        setStatus('done')
        onDone?.(r)
        return
      }

      const data: PrintResult = await res.json()

      // Téléchargements multiples si fallback
      if (data.labels && data.labels.length > 0) {
        for (const label of data.labels) {
          await new Promise(r => setTimeout(r, 150))
          const a = document.createElement('a')
          a.href = `data:image/png;base64,${label.pngBase64}`
          a.download = label.filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      }

      setResult(data)
      setStatus('done')
      onDone?.(data)
    } catch (err) {
      const r: PrintResult = { ok: false, message: (err as Error).message }
      setResult(r)
      setStatus('error')
    }
  }

  const count = selectedIds.length

  // Icône selon état agent
  const icon =
    agentAvailable === null ? '⏳' :
    agentAvailable ? '🖨️' :
    '📥'

  const btnLabel =
    status === 'loading' ? 'Impression…' :
    `${icon} Imprimer (${count})`

  return (
    <>
      <button
        disabled={status === 'loading' || count === 0}
        onClick={handlePrint}
        className="text-[11px] px-3 py-1 rounded text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ background: 'var(--csn-navy)' }}
        title={
          agentAvailable === false
            ? 'Agent non disponible — téléchargement PNG'
            : agentAvailable
            ? 'Agent disponible — impression directe'
            : 'Vérification agent…'
        }
      >
        {btnLabel}
      </button>

      {result && status === 'done' && (
        <ResultModal result={result} onClose={() => setResult(null)} />
      )}
    </>
  )
}
