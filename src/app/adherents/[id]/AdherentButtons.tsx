'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { togglePassager } from '@/app/actions/adherents'

// ─── Modal preview étiquette ──────────────────────────────────────────────────
function LabelPreviewModal({
  nom,
  prenom,
  expire,
  onClose,
}: {
  nom: string
  prenom: string
  expire: string
  onClose: () => void
}) {
  const params = new URLSearchParams({ nom, prenom, expire, format: 'html' })
  const previewUrl = `/api/print/preview?${params.toString()}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--csn-border)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            🏷️ Prévisualisation étiquette
          </span>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        {/* Preview dans iframe */}
        <iframe
          src={previewUrl}
          className="w-full"
          style={{ height: 420, border: 'none' }}
          title="Prévisualisation étiquette"
        />

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2"
          style={{ borderColor: 'var(--csn-border)', background: 'var(--csn-cream)' }}>
          <span className="text-[11px] text-slate-400 self-center mr-auto">
            📥 Agent non disponible — téléchargement PNG
          </span>
          <button onClick={onClose}
            className="text-[12px] px-3 py-1.5 rounded border hover:bg-slate-50 transition-colors"
            style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BoutonEtiquette ──────────────────────────────────────────────────────────
export function BoutonEtiquette({
  adherentId,
  nom,
  prenom,
  dateExpiration,
}: {
  adherentId: string
  nom: string
  prenom: string
  dateExpiration?: string | null
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  async function handleClick() {
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adherentIds: [adherentId],
          simulate: false,
          force: false,
        }),
      })

      const contentType = res.headers.get('content-type') ?? ''

      // Agent disponible → impression directe, réponse JSON
      if (contentType.includes('application/json')) {
        const data = await res.json()

        // Tous déjà imprimés
        if (!data.ok && data.skipped > 0) {
          setStatus('done')
          return
        }

        if (data.mode === 'agent') {
          setStatus('done')
          return
        }

        // Fallback : agent absent → afficher preview + download
        if (data.mode === 'fallback-download' && data.labels?.length > 0) {
          // Download automatique
          const label = data.labels[0]
          const a = document.createElement('a')
          a.href = `data:image/png;base64,${label.pngBase64}`
          a.download = label.filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setStatus('preview')
          setShowPreview(true)
          return
        }
      }

      // Réponse PNG binaire directe (un seul adhérent, fallback)
      if (contentType.includes('image/png')) {
        const blob = await res.blob()
        const filename =
          res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
          'label.png'
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setStatus('preview')
        setShowPreview(true)
        return
      }

      setStatus('done')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setStatus('error')
    }
  }

  const label =
    status === 'loading' ? '…' :
    status === 'done'    ? '✓ Imprimé' :
    status === 'preview' ? '✓ Téléchargé' :
    status === 'error'   ? '✗ Erreur' :
    '🖨 Étiquette'

  return (
    <>
      <button
        disabled={status === 'loading'}
        className="text-[12px] px-3 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background:
            status === 'done' || status === 'preview' ? '#16a34a' :
            status === 'error' ? '#dc2626' :
            'var(--csn-navy)',
        }}
        onClick={handleClick}
        title={errorMsg || undefined}
      >
        {label}
      </button>

      {showPreview && (
        <LabelPreviewModal
          nom={nom}
          prenom={prenom}
          expire={dateExpiration ?? '31/12/2026'}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}

// ─── BoutonAttestation (inchangé) ─────────────────────────────────────────────
export function BoutonAttestation({ adherentId }: { adherentId: string }) {
  return (
    <button
      className="text-[12px] px-3 py-2 rounded-lg border transition-colors hover:bg-slate-50"
      style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}
      onClick={() => alert('Envoi attestation — à venir Phase 4')}
    >
      ✉ Attestation
    </button>
  )
}

// ─── TogglePassager (inchangé) ────────────────────────────────────────────────
export function TogglePassager({
  adherentId,
  initialValue,
}: {
  adherentId: string
  initialValue: boolean
}) {
  const [passager, setPassager] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      await togglePassager(adherentId, checked)
      setPassager(checked)
      router.refresh()
    })
  }

  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={passager}
          onChange={e => handleChange(e.target.checked)}
          disabled={isPending}
          className="sr-only"
        />
        <div
          className="w-9 h-5 rounded-full transition-colors"
          style={{
            background: passager ? 'var(--csn-navy)' : '#e2e8f0',
            opacity: isPending ? 0.6 : 1,
          }}
        />
        <div
          className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: passager ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </div>
      <span className="text-[13px]" style={{ color: passager ? 'var(--csn-navy)' : '#64748b' }}>
        {passager ? 'Passager (licence dans un autre club)' : 'Membre standard'}
      </span>
    </label>
  )
}
