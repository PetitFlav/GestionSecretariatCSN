'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getImpactSuppression, supprimerAdherent, type ImpactSuppression } from '@/app/actions/adherents'

// Bouton « Supprimer la fiche » — à n'afficher QUE pour les administrateurs
// (le serveur revérifie de toute façon avec requireAdmin).
//
// Deux étapes de confirmation :
//   1. le clic affiche ce qui partira avec la fiche (impressions, attestations…)
//      et rappelle que VPdive la recréera si elle y existe encore ;
//   2. il faut retaper le NOM de famille pour activer le bouton rouge.
//
// `apres` : où aller une fois supprimé (la fiche elle-même n'existe plus) ;
// sans valeur, la page courante est simplement rafraîchie (cas du suivi).

export default function SupprimerAdherent({ adherentId, compact = false, apres }: {
  adherentId: string
  compact?:   boolean          // petite icône (lignes du suivi) ou bouton texte (fiche)
  apres?:     string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [impact, setImpact] = useState<ImpactSuppression | null>(null)
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const norm = (v: string) =>
    v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
  const nomOk = !!impact?.nom && norm(saisie) === norm(impact.nom)

  function ouvrir() {
    setErreur(null)
    setSaisie('')
    startTransition(async () => {
      const res = await getImpactSuppression(adherentId)
      if (res.ok) setImpact(res)
      else setErreur(res.error ?? 'Erreur')
    })
  }

  function confirmer() {
    startTransition(async () => {
      const res = await supprimerAdherent(adherentId, saisie)
      if (!res.ok) { setErreur(res.error ?? 'Erreur'); return }
      setImpact(null)
      // replace (et pas push) : la fiche supprimée disparaît de l'historique,
      // sinon le retour arrière du navigateur y ramène → 404.
      if (apres) router.replace(apres)
      else router.refresh()
    })
  }

  const lies = impact
    ? [
        impact.impressions  ? `${impact.impressions} impression(s) d'étiquette`  : null,
        impact.attestations ? `${impact.attestations} attestation(s) envoyée(s)` : null,
        impact.rappels      ? `${impact.rappels} rappel(s) CACI`                 : null,
      ].filter(Boolean)
    : []

  return (
    <>
      {compact ? (
        <button onClick={ouvrir} disabled={isPending} title="Supprimer cette fiche (administrateur)"
          className="text-[11px] px-2 py-1 rounded border hover:bg-red-50 flex-shrink-0 disabled:opacity-50"
          style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
          ✕
        </button>
      ) : (
        <button onClick={ouvrir} disabled={isPending}
          className="text-[12px] px-3 py-1.5 rounded-lg border hover:bg-red-50 disabled:opacity-50"
          style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
          Supprimer cette fiche…
        </button>
      )}

      {erreur && !impact && <span className="ml-2 text-[11px]" style={{ color: '#dc2626' }}>{erreur}</span>}

      {/* Fenêtre de confirmation */}
      {impact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(15, 23, 42, 0.45)' }}
          onClick={() => !isPending && setImpact(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md flex flex-col gap-3 text-left"
            style={{ border: '0.5px solid #fca5a5' }}
            onClick={e => e.stopPropagation()}>

            <h2 className="text-[15px] font-medium" style={{ color: '#9b1c1c' }}>
              Supprimer définitivement cette fiche ?
            </h2>

            <div className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>
              <strong>{impact.prenom} {impact.nom}</strong>
              <span className="text-slate-400"> — saison {impact.saison}</span>
            </div>

            <div className="text-[12px] text-slate-600 flex flex-col gap-1">
              <div>
                {lies.length
                  ? <>Seront aussi supprimés : {lies.join(', ')}.</>
                  : <>Aucune impression, attestation ni rappel lié.</>}
              </div>
              <div style={{ color: '#7a5a00' }}>
                ⚠ Si cette personne figure encore sous ce nom dans VPdive, le prochain
                import recréera la fiche : corrigez VPdive d&apos;abord.
              </div>
            </div>

            <div>
              <label className="text-[12px] text-slate-500 mb-1 block">
                Pour confirmer, tapez le nom de famille : <strong>{impact.nom}</strong>
              </label>
              <input value={saisie} onChange={e => setSaisie(e.target.value)} autoFocus
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }} />
            </div>

            {erreur && <div className="text-[12px]" style={{ color: '#dc2626' }}>{erreur}</div>}

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setImpact(null)} disabled={isPending}
                className="text-[12px] px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>
                Annuler
              </button>
              <button onClick={confirmer} disabled={!nomOk || isPending}
                className="text-[12px] px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                style={{ background: '#dc2626' }}>
                {isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
