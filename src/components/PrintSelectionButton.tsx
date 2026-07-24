'use client'

/**
 * src/components/PrintSelectionButton.tsx  (v2)
 *
 * Architecture : le NAVIGATEUR orchestre tout.
 *
 * Pour chaque adhérent sélectionné :
 *   1. GET  /api/label?adherentId=xxx     → Vercel génère le PNG
 *   2. POST http://localhost:3333/print   → navigateur envoie à l'agent local
 *      ✓ Succès → POST /api/print/record  → enregistre PRINTED en base
 *      ✗ Échec  → télécharge le PNG       → fallback download
 */

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LabelPayload {
  ok: boolean
  pngBase64: string
  filename: string
  checksum: string
  adherentId: string
  saisonId: string
  nom: string
  prenom: string
  expire: string
}

interface JobResult {
  adherentId: string
  nom: string
  prenom: string
  filename: string
  pngBase64: string
  status: 'printed' | 'downloaded' | 'skipped' | 'error'
  error?: string
}

interface Props {
  selectedIds: string[]
  onDone?: (results: JobResult[]) => void
  force?: boolean
}

const AGENT_URL = 'http://localhost:3333'
const AGENT_TIMEOUT_MS = 2000

// ── Vérifie si l'agent est joignable depuis le navigateur ────────────────────
async function checkAgent(): Promise<boolean> {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS)
    const res   = await fetch(`${AGENT_URL}/status`, {
      signal: ctrl.signal,
      mode: 'cors',
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

// ── Envoie le PNG à l'agent depuis le navigateur ─────────────────────────────
async function printViaAgent(label: LabelPayload): Promise<void> {
  const res = await fetch(`${AGENT_URL}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    mode: 'cors',
    body: JSON.stringify({
      image:  label.pngBase64,
      nom:    label.nom,
      prenom: label.prenom,
      expire: label.expire,
      copies: 1,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Agent ${res.status}: ${body}`)
  }
}

// ── Enregistre l'impression en base via Vercel ───────────────────────────────
async function recordPrinted(label: LabelPayload, force: boolean): Promise<boolean> {
  const res = await fetch('/api/print/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adherentId: label.adherentId,
      saisonId:   label.saisonId,
      checksum:   label.checksum,
      force,
    }),
  })
  const data = await res.json()
  return data.ok === true
}

// ── Télécharge le PNG dans le navigateur ─────────────────────────────────────
function downloadPng(label: LabelPayload): void {
  const a = document.createElement('a')
  a.href     = `data:image/png;base64,${label.pngBase64}`
  a.download = label.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Modal résultat ────────────────────────────────────────────────────────────
function ResultModal({
  results,
  agentUsed,
  onClose,
}: {
  results: JobResult[]
  agentUsed: boolean
  onClose: () => void
}) {
  const printed    = results.filter(r => r.status === 'printed')
  const downloaded = results.filter(r => r.status === 'downloaded')
  const skipped    = results.filter(r => r.status === 'skipped')
  const errors     = results.filter(r => r.status === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--csn-border)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            {errors.length === 0 ? '✅ Impression terminée' : '⚠️ Résultat impression'}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        {/* Corps */}
        <div className="px-4 py-4 flex flex-col gap-3">

          {printed.length > 0 && (
            <div className="text-[13px] text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
              🖨️ {printed.length} étiquette{printed.length > 1 ? 's' : ''} envoyée{printed.length > 1 ? 's' : ''} à l'imprimante.
            </div>
          )}

          {downloaded.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[13px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
                📥 Agent non disponible — {downloaded.length} PNG téléchargé{downloaded.length > 1 ? 's' : ''}.
              </div>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {downloaded.map(r => (
                  <div key={r.adherentId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded border text-[12px]"
                    style={{ borderColor: 'var(--csn-border)' }}>
                    <img src={`data:image/png;base64,${r.pngBase64}`}
                      className="h-10 rounded" alt="" />
                    <span className="flex-1 truncate" style={{ color: 'var(--csn-navy)' }}>
                      {r.nom} {r.prenom}
                    </span>
                    <a href={`data:image/png;base64,${r.pngBase64}`} download={r.filename}
                      className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50"
                      style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}>↓</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              ⏭ {skipped.length} déjà imprimé{skipped.length > 1 ? 's' : ''} — ignoré{skipped.length > 1 ? 's' : ''}.
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {skipped.map(r => `${r.nom} ${r.prenom}`).join(', ')}
              </span>
            </div>
          )}

          {errors.length > 0 && (
            <div className="text-[12px] text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {errors.map((r, i) => <div key={i}>✗ {r.nom} {r.prenom} : {r.error}</div>)}
            </div>
          )}

          {!agentUsed && downloaded.length === 0 && (
            <div className="text-[12px] text-slate-400">
              💡 Pour imprimer directement, lancez l'agent sur le PC connecté à l'imprimante :
              <code className="block mt-1 bg-slate-100 px-2 py-1 rounded text-[11px]">
                cd C:\agent && node agent.js
              </code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end"
          style={{ borderColor: 'var(--csn-border)', background: 'var(--csn-cream)' }}>
          <button onClick={onClose}
            className="text-[12px] px-4 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--csn-navy)' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ── PrintSelectionButton ──────────────────────────────────────────────────────
export function PrintSelectionButton({ selectedIds, onDone, force = false }: Props) {
  const [status, setStatus]        = useState<'idle' | 'loading' | 'done'>('idle')
  const [agentAvailable, setAgent] = useState<boolean | null>(null)
  const [results, setResults]      = useState<JobResult[] | null>(null)
  const [agentUsed, setAgentUsed]  = useState(false)

  // Ping agent depuis le navigateur au montage + toutes les 15s
  useEffect(() => {
    let mounted = true
    const ping = async () => {
      const ok = await checkAgent()
      if (mounted) setAgent(ok)
    }
    ping()
    const interval = setInterval(ping, 15_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  async function handlePrint() {
    if (selectedIds.length === 0 || status === 'loading') return
    setStatus('loading')

    const jobResults: JobResult[] = []
    let usedAgent = false

    for (const adherentId of selectedIds) {
      // 1. Récupère le PNG depuis Vercel
      let label: LabelPayload
      try {
        const res = await fetch(`/api/label?adherentId=${adherentId}`)
        label = await res.json()
        if (!label.ok) throw new Error(label as unknown as string)
      } catch (err) {
        jobResults.push({
          adherentId, nom: '?', prenom: '?', filename: '', pngBase64: '',
          status: 'error', error: `Génération PNG échouée : ${(err as Error).message}`,
        })
        continue
      }

      // 2. Tente l'impression via l'agent local (depuis le navigateur)
      const agentOk = await checkAgent()

      if (agentOk) {
        try {
          await printViaAgent(label)
          // 3. Enregistre en base
          const recorded = await recordPrinted(label, force)
          if (!recorded) {
            // Déjà imprimé + pas force → skipped
            jobResults.push({
              adherentId, nom: label.nom, prenom: label.prenom,
              filename: label.filename, pngBase64: label.pngBase64,
              status: 'skipped',
            })
          } else {
            jobResults.push({
              adherentId, nom: label.nom, prenom: label.prenom,
              filename: label.filename, pngBase64: label.pngBase64,
              status: 'printed',
            })
            usedAgent = true
          }
          continue
        } catch (err) {
          // Agent a échoué → fallback download
          console.warn('Agent échec, fallback download:', err)
        }
      }

      // Fallback : téléchargement PNG
      downloadPng(label)
      jobResults.push({
        adherentId, nom: label.nom, prenom: label.prenom,
        filename: label.filename, pngBase64: label.pngBase64,
        status: 'downloaded',
      })

      // Petit délai entre les downloads multiples
      if (selectedIds.length > 1) await new Promise(r => setTimeout(r, 200))
    }

    setAgentUsed(usedAgent)
    setResults(jobResults)
    setStatus('done')
    onDone?.(jobResults)
  }

  const icon  = agentAvailable === null ? '⏳' : agentAvailable ? '🖨️' : '📥'
  const label = status === 'loading'
    ? 'Impression…'
    : `${icon} Imprimer (${selectedIds.length})`

  return (
    <>
      <button
        disabled={status === 'loading' || selectedIds.length === 0}
        onClick={handlePrint}
        className="text-[11px] px-3 py-1 rounded text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ background: 'var(--csn-navy)' }}
        title={
          agentAvailable
            ? '🖨️ Agent local disponible — impression directe'
            : '📥 Agent absent — téléchargement PNG'
        }
      >
        {label}
      </button>

      {results && status === 'done' && (
        <ResultModal
          results={results}
          agentUsed={agentUsed}
          onClose={() => { setResults(null); setStatus('idle') }}
        />
      )}
    </>
  )
}
