'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ajouterFonction, retirerFonction, reprendreBureauPrecedent, ResultatReprise,
} from '@/app/actions/bureau'

interface Fonction { id: string; code: string; libelle: string }
interface Membre   { affectationId: string; fonctionId: string; adherentId: string; nom: string; prenom: string }
interface Personne { id: string; nom: string; prenom: string }

const champStyle = {
  border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)',
}

/** Minuscules sans accents, pour une recherche tolérante. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export default function BureauClient({ saisons, saisonId, fonctions, membres, adherents }: {
  saisons:   { id: string; label: string; isActive: boolean }[]
  saisonId:  string
  fonctions: Fonction[]
  membres:   Membre[]
  adherents: Personne[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [reprise, setReprise] = useState<ResultatReprise | null>(null)

  /** Lance une action serveur puis recharge les données de la page. */
  function executer(action: () => Promise<{ ok: boolean; error?: string }>) {
    setErreur(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setErreur(res.error ?? 'Erreur')
      router.refresh()
    })
  }

  function reprendre() {
    if (!window.confirm('Recopier sur cette saison les fonctions de la saison précédente ? Rien ne sera effacé.')) return
    setErreur(null)
    setReprise(null)
    startTransition(async () => {
      const res = await reprendreBureauPrecedent(saisonId)
      if (res.ok) setReprise(res)
      else setErreur(res.error ?? 'Erreur')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Choix de la saison + reprise */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Saison</label>
          <select value={saisonId}
            onChange={e => { setReprise(null); setErreur(null); router.push(`/admin/bureau?saison=${e.target.value}`) }}
            className="px-3 py-1.5 text-[13px] rounded-lg outline-none" style={champStyle}>
            {saisons.map(s => (
              <option key={s.id} value={s.id}>{s.label}{s.isActive ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>
        <button onClick={reprendre} disabled={isPending}
          className="text-[12px] px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50 disabled:opacity-60"
          style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>
          Reprendre le bureau de la saison précédente
        </button>
      </div>

      {erreur && (
        <div className="rounded-lg px-3 py-2 text-[12px]"
          style={{ background: '#fdecec', border: '0.5px solid #f3b4b4', color: '#9b1c1c' }}>
          {erreur}
        </div>
      )}

      {reprise && <CompteRenduReprise res={reprise} onFermer={() => setReprise(null)} />}

      {/* Une carte par fonction */}
      {fonctions.map(f => (
        <CarteFonction key={f.id}
          fonction={f}
          membres={membres.filter(m => m.fonctionId === f.id)}
          adherents={adherents}
          unSeul={f.code === 'PRESIDENT'}
          isPending={isPending}
          onAjouter={adherentId => executer(() => ajouterFonction(adherentId, f.id))}
          onRetirer={affectationId => executer(() => retirerFonction(affectationId))}
        />
      ))}
    </div>
  )
}

function CarteFonction({ fonction, membres, adherents, unSeul, isPending, onAjouter, onRetirer }: {
  fonction:  Fonction
  membres:   Membre[]
  adherents: Personne[]
  unSeul:    boolean
  isPending: boolean
  onAjouter: (adherentId: string) => void
  onRetirer: (affectationId: string) => void
}) {
  const [recherche, setRecherche] = useState('')
  const dejaLa = new Set(membres.map(m => m.adherentId))
  const complet = unSeul && membres.length >= 1

  const q = norm(recherche)
  const suggestions = q.length < 2 ? [] : adherents
    .filter(a => !dejaLa.has(a.id))
    .filter(a => norm(`${a.prenom} ${a.nom}`).includes(q) || norm(`${a.nom} ${a.prenom}`).includes(q))
    .slice(0, 8)

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '0.5px solid var(--csn-border-strong)' }}>
      <div className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>
        {fonction.libelle}
        {unSeul && <span className="text-[11px] font-normal text-slate-400"> — une seule personne par saison</span>}
      </div>

      {membres.length === 0 ? (
        <div className="text-[12px] text-slate-400">Personne n&apos;est désigné.</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {membres.map(m => (
            <li key={m.affectationId} className="flex items-center gap-3 text-[13px]" style={{ color: '#1a2e3f' }}>
              <span className="flex-1">{m.prenom} {m.nom.toUpperCase()}</span>
              <button onClick={() => onRetirer(m.affectationId)} disabled={isPending}
                className="text-[11px] px-2 py-0.5 rounded border transition-colors hover:bg-slate-50 disabled:opacity-60"
                style={{ borderColor: 'var(--csn-border-strong)', color: '#9b1c1c' }}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {!complet && (
        <div className="relative">
          <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Ajouter : tapez un nom ou un prénom…"
            className="w-full px-3 py-1.5 text-[13px] rounded-lg outline-none" style={champStyle} />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg z-10 py-1"
              style={{ border: '0.5px solid var(--csn-border-strong)', boxShadow: '0 4px 16px rgba(26,58,92,0.08)' }}>
              {suggestions.map(a => (
                <li key={a.id}>
                  <button disabled={isPending}
                    onClick={() => { onAjouter(a.id); setRecherche('') }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 disabled:opacity-60"
                    style={{ color: 'var(--csn-navy)' }}>
                    {a.prenom} {a.nom.toUpperCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && suggestions.length === 0 && (
            <div className="text-[11px] text-slate-400 mt-1">Aucun adhérent de cette saison ne correspond.</div>
          )}
        </div>
      )}
    </div>
  )
}

function CompteRenduReprise({ res, onFermer }: { res: ResultatReprise; onFermer: () => void }) {
  const blocs: { titre: string; liste?: string[]; couleur: string }[] = [
    { titre: 'Recopiés',                                   liste: res.ajoutes,      couleur: '#1a6642' },
    { titre: 'Déjà en place',                              liste: res.dejaPresents, couleur: '#64748b' },
    { titre: 'Introuvables dans cette saison (pas encore réinscrits ?)', liste: res.introuvables, couleur: '#7a5a00' },
    { titre: 'Non recopiés',                               liste: res.conflits,     couleur: '#9b1c1c' },
  ]
  return (
    <div className="rounded-lg p-3 text-[12px] bg-white flex flex-col gap-2"
      style={{ border: '0.5px solid var(--csn-border-strong)', color: '#1a2e3f' }}>
      <div className="flex items-center">
        <span className="flex-1 font-medium">Reprise depuis la saison {res.saisonPrecedente}</span>
        <button onClick={onFermer} className="text-slate-400 hover:text-slate-600 text-[11px]">Fermer</button>
      </div>
      {blocs.filter(b => b.liste && b.liste.length > 0).map(b => (
        <div key={b.titre}>
          <div style={{ color: b.couleur }}>{b.titre} ({b.liste!.length})</div>
          <ul className="list-disc ml-5 text-slate-600">
            {b.liste!.map(l => <li key={l}>{l}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
