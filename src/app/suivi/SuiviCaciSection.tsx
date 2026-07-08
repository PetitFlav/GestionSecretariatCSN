'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlerteCaci } from '@/app/actions/adherents'
import { envoyerRappelsCaci, RappelResult } from '@/app/actions/rappels-caci'

interface Props {
  title:       string
  count:       number
  severity:    'critical' | 'warning'
  description: string
  alertes:     AlerteCaci[]
  type:        'expire' | 'bientot'
  saisonId:    string
}

export default function SuiviCaciSection({
  title, count, severity, description, alertes, type, saisonId
}: Props) {
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [isSending, startSending] = useTransition()
  const [result, setResult]       = useState<RappelResult | null>(null)
  const [localRappels, setLocalRappels] = useState<Map<string, number>>(
    new Map(alertes.map(a => [a.id, a.nbRappels]))
  )

  const c = severity === 'critical'
    ? { border: '#fca5a5', bg: '#fff5f5', dot: '#dc2626' }
    : { border: '#e8c96a', bg: '#fffdf0', dot: '#d97706' }

  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(selected.size === alertes.length ? new Set() : new Set(alertes.map(a => a.id)))
  }

  function handleSend() {
    startSending(async () => {
      setResult(null)
      const ids = Array.from(selected)
      const res = await envoyerRappelsCaci(ids, saisonId, type)
      setResult(res)
      if (res.envoyes > 0) {
        // Mettre à jour les compteurs localement
        setLocalRappels(prev => {
          const next = new Map(prev)
          ids.forEach(id => next.set(id, (next.get(id) ?? 0) + 1))
          return next
        })
        setSelected(new Set())
      }
    })
  }

  return (
    <div className="mb-5 rounded-xl overflow-hidden" style={{ border: `0.5px solid ${c.border}` }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ background: c.bg, borderBottom: `0.5px solid ${c.border}` }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
        <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>{title}</span>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
          style={{ background: c.dot }}>{count}</span>
      </div>

      <p className="px-4 py-2 text-[12px] text-slate-400" style={{ background: c.bg }}>{description}</p>

      {/* Barre d'actions */}
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap"
        style={{ background: c.bg, borderBottom: `0.5px solid ${c.border}` }}>
        <label className="flex items-center gap-2 cursor-pointer text-[12px] text-slate-500">
          <input type="checkbox"
            checked={selected.size === alertes.length && alertes.length > 0}
            onChange={toggleAll} className="cursor-pointer" />
          Tout sélectionner
        </label>

        {selected.size > 0 && (
          <button
            onClick={handleSend}
            disabled={isSending}
            className="text-[11px] px-3 py-1.5 rounded text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'var(--csn-navy)' }}>
            {isSending ? 'Envoi…' : `✉ Envoyer rappel (${selected.size})`}
          </button>
        )}

        {selected.size === 0 && (
          <span className="text-[11px] text-slate-400">
            Sélectionnez des lignes pour envoyer un rappel par email
          </span>
        )}
      </div>

      {/* Résultat envoi */}
      {result && (
        <div className="px-4 py-3 text-[12px]"
          style={{
            background: result.envoyes > 0 ? '#eaf7f0' : '#fff3cd',
            borderBottom: `0.5px solid ${result.envoyes > 0 ? '#7dd4a8' : '#e8c96a'}`,
            color: result.envoyes > 0 ? '#1a6642' : '#7a5a00',
          }}>
          {result.envoyes > 0 && (
            <p>✓ {result.envoyes} rappel{result.envoyes > 1 ? 's' : ''} envoyé{result.envoyes > 1 ? 's' : ''}</p>
          )}
          {result.erreurs.map((e, i) => (
            <p key={i}>• {e.prenom} {e.nom} — {e.raison}</p>
          ))}
        </div>
      )}

      {/* Liste */}
      <div className="bg-white">
        {alertes.map(a => {
          const nbRappels = localRappels.get(a.id) ?? 0
          return (
            <div key={a.id}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: '0.5px solid var(--csn-border)' }}>

              <input type="checkbox"
                checked={selected.has(a.id)}
                onChange={() => toggleOne(a.id)}
                className="cursor-pointer flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
                  {a.prenom} {a.nom}
                </span>
                {nbRappels > 0 && (
                  <span className="ml-2 text-[10px] text-slate-400">
                    {nbRappels} rappel{nbRappels > 1 ? 's' : ''} envoyé{nbRappels > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Badge CACI */}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{
                  background: a.jours < 0 ? '#fee2e2' : '#fff3cd',
                  color:      a.jours < 0 ? '#dc2626' : '#7a5a00',
                }}>
                {a.caci === 'Non renseigné'
                  ? 'Manquant'
                  : a.jours < 0
                    ? `Expiré le ${a.caci}`
                    : `Expire le ${a.caci} (${a.jours}j)`
                }
              </span>

              <Link href={`/adherents/${a.id}`}
                className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50 flex-shrink-0"
                style={{ borderColor: 'var(--csn-border)', color: 'var(--csn-blue)' }}>→</Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
