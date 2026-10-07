'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateStatutAdherent } from '@/app/actions/adherents'
import { STATUTS, STATUT_LABEL, STATUT_DESCRIPTION, Statut } from '@/lib/statut'

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

// ── StatutAdherentForm ────────────────────────────────────────────────────────
export function StatutAdherentForm({
  adherentId, initialStatut, initialForce, initialNote, ffessmTrouve,
}: {
  adherentId:    string
  initialStatut: Statut
  initialForce:  boolean
  initialNote:   string | null
  ffessmTrouve:  boolean   // licence retrouvée dans le fichier FFESSM importé
}) {
  const [statut, setStatut] = useState<Statut>(initialStatut)
  const [force, setForce]   = useState(initialForce)
  const [note, setNote]     = useState(initialNote ?? '')
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const dirty = statut !== initialStatut || force !== initialForce
    || (force && note.trim() !== (initialNote ?? ''))

  // Le forçage n'a de sens que pour quelqu'un censé être dans le fichier FFESSM
  // du club et qui n'y a pas été retrouvé.
  const forcageUtile = statut !== 'EXTERNE' && !ffessmTrouve

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateStatutAdherent(adherentId, {
        statut, ffessmForce: forcageUtile && force, ffessmForceNote: note,
      })
      setMsg(res.success
        ? { ok: true,  text: 'Enregistré' }
        : { ok: false, text: res.error ?? 'Erreur' })
      if (res.success) router.refresh()
    })
  }

  const fieldStyle = {
    border: '0.5px solid var(--csn-border-strong)',
    background: 'var(--csn-cream)',
    color: 'var(--csn-navy)',
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statut}
          onChange={e => setStatut(e.target.value as Statut)}
          disabled={isPending}
          className="px-3 py-2 text-[13px] rounded-lg outline-none"
          style={fieldStyle}
        >
          {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
        </select>
        <span className="text-[11px] text-slate-400 flex-1 min-w-[200px]">
          {STATUT_DESCRIPTION[statut]}
        </span>
      </div>

      {forcageUtile && (
        <div className="rounded-lg p-3 flex flex-col gap-2"
          style={{ background: force ? '#eaf7f0' : '#fff8e6', border: `0.5px solid ${force ? '#7dd4a8' : '#e8c96a'}` }}>
          <label className="flex items-center gap-2 cursor-pointer text-[13px]" style={{ color: 'var(--csn-navy)' }}>
            <input type="checkbox" checked={force} disabled={isPending}
              onChange={e => setForce(e.target.checked)} />
            Validation FFESSM forcée
          </label>
          <p className="text-[11px] text-slate-500">
            Non retrouvé dans le fichier FFESSM importé. Cochez si vous avez vérifié sur le
            portail FFESSM que la licence est bien enregistrée : la personne sortira des anomalies.
          </p>
          {force && (
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Motif (ex. : nom de naissance différent sur FFESSM)"
              disabled={isPending}
              className="px-3 py-2 text-[12px] rounded-lg outline-none"
              style={fieldStyle}
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || isPending}
          className="text-[12px] px-3 py-2 rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: 'var(--csn-navy)' }}
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {msg && (
          <span className="text-[12px]" style={{ color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</span>
        )}
      </div>
    </div>
  )
}
