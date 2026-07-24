'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { togglePassager } from '@/app/actions/adherents'

const AGENT_URL       = 'http://localhost:3333'
const AGENT_TIMEOUT   = 2000

async function checkAgent(): Promise<boolean> {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT)
    const res   = await fetch(`${AGENT_URL}/status`, { signal: ctrl.signal, mode: 'cors' })
    clearTimeout(timer)
    return res.ok
  } catch { return false }
}

// ── BoutonEtiquette ───────────────────────────────────────────────────────────
export function BoutonEtiquette({
  adherentId,
}: {
  adherentId: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'downloaded' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    setStatus('loading')
    setErrorMsg('')

    try {
      // 1. Génère le PNG via Vercel
      const res   = await fetch(`/api/label?adherentId=${adherentId}`)
      const label = await res.json()
      if (!label.ok) throw new Error('Génération PNG échouée')

      // 2. Tente l'agent local depuis le navigateur
      const agentOk = await checkAgent()

      if (agentOk) {
        const printRes = await fetch(`${AGENT_URL}/print`, {
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

        if (printRes.ok) {
          // 3. Enregistre en base
          await fetch('/api/print/record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adherentId: label.adherentId,
              saisonId:   label.saisonId,
              checksum:   label.checksum,
              force:      false,
            }),
          })
          setStatus('done')
          return
        }
      }

      // Fallback : téléchargement PNG
      const a = document.createElement('a')
      a.href     = `data:image/png;base64,${label.pngBase64}`
      a.download = label.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setStatus('downloaded')

    } catch (err) {
      setErrorMsg((err as Error).message)
      setStatus('error')
    }
  }

  const btnLabel =
    status === 'loading'    ? '…' :
    status === 'done'       ? '✓ Imprimé' :
    status === 'downloaded' ? '✓ Téléchargé' :
    status === 'error'      ? '✗ Erreur' :
    '🖨 Étiquette'

  return (
    <button
      disabled={status === 'loading'}
      className="text-[12px] px-3 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{
        background:
          status === 'done'       ? '#16a34a' :
          status === 'downloaded' ? '#d97706' :
          status === 'error'      ? '#dc2626' :
          'var(--csn-navy)',
      }}
      onClick={handleClick}
      title={errorMsg || undefined}
    >
      {btnLabel}
    </button>
  )
}

// ── BoutonAttestation ─────────────────────────────────────────────────────────
export function BoutonAttestation({ adherentId }: { adherentId: string }) {
  return (
    <button
      className="text-[12px] px-3 py-2 rounded-lg border transition-colors hover:bg-slate-50"
      style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}
      onClick={() => alert('Envoi attestation — à venir Phase 4')}>
      ✉ Attestation
    </button>
  )
}

// ── TogglePassager ────────────────────────────────────────────────────────────
export function TogglePassager({
  adherentId, initialValue,
}: {
  adherentId: string; initialValue: boolean
}) {
  const [passager, setPassager]      = useState(initialValue)
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
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div className="relative">
        <input type="checkbox" checked={passager}
          onChange={e => handleChange(e.target.checked)}
          disabled={isPending} className="sr-only" />
        <div className="w-9 h-5 rounded-full transition-colors"
          style={{ background: passager ? 'var(--csn-navy)' : '#e2e8f0', opacity: isPending ? 0.6 : 1 }} />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: passager ? 'translateX(16px)' : 'translateX(0)' }} />
      </div>
      <span className="text-[13px]" style={{ color: passager ? 'var(--csn-navy)' : '#64748b' }}>
        {passager ? 'Passager (licence dans un autre club)' : 'Membre standard'}
      </span>
    </label>
  )
}
