'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ContexteDemande } from '@/lib/demande-accueil-serveur'
import { controlerSaisie, DELAI_CONSEILLE_JOURS, joursAvant, SaisieDemande } from '@/lib/demande-accueil'
import { envoyerDemande } from '@/app/actions/demande-accueil'

const champStyle = {
  border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)',
}
const carteStyle = { border: '0.5px solid var(--csn-border-strong)' }

type Personne = ContexteDemande['adherents'][number]

/** Minuscules sans accents, pour une recherche tolérante. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function Libelle({ children, requis }: { children: React.ReactNode; requis?: boolean }) {
  return (
    <label className="text-[12px] text-slate-500 mb-1 block">
      {children} {requis && <span className="text-red-400">*</span>}
    </label>
  )
}

export default function DemandeAccueilClient({ ctx }: { ctx: ContexteDemande }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [saisie, setSaisie] = useState<SaisieDemande>({
    typeDemandeId:   ctx.types[0]?.id ?? '',
    dateSouhaitee:   '',
    heureDebut:      '',
    heureFin:        '',
    responsable1Id:  '',
    responsable2Id:  '',
    nbAdultes:       0,
    nbEnfants:       0,
    presidentTel:    ctx.presidentTel,
    demandeurTel:    ctx.demandeurTel,
    destinataireIds: ctx.destinataires.filter(d => d.selectionne).map(d => d.id),
  })
  const [erreurs, setErreurs]   = useState<string[]>([])
  const [apercuUrl, setApercuUrl] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  // Libère l'URL de l'aperçu précédent
  useEffect(() => () => { if (apercuUrl) URL.revokeObjectURL(apercuUrl) }, [apercuUrl])

  /** Toute modification rend l'aperçu obsolète. */
  function maj(champs: Partial<SaisieDemande>) {
    setSaisie(s => ({ ...s, ...champs }))
    setApercuUrl(null)
    setSucces(null)
  }

  const jours = saisie.dateSouhaitee ? joursAvant(saisie.dateSouhaitee) : null
  const personne = (id: string) => ctx.adherents.find(a => a.id === id)
  const r1 = personne(saisie.responsable1Id)
  const r2 = personne(saisie.responsable2Id)

  // Avertissements non bloquants calculés à l'écran
  const avertissements: string[] = []
  if (jours !== null && jours < 0) avertissements.push('La date souhaitée est passée.')
  else if (jours !== null && jours < DELAI_CONSEILLE_JOURS) {
    avertissements.push(`La date est dans ${jours} jour(s) : la Ville demande ${DELAI_CONSEILLE_JOURS} jours de délai.`)
  }
  if (ctx.president?.depuisPrecedente) {
    avertissements.push(`Président·e repris de la saison ${ctx.president.saisonLabel} (pas encore désigné sur la saison active).`)
  }
  if (ctx.president && !ctx.president.email) avertissements.push("Le président·e n'a pas de courriel : champ vide sur le PDF, pas de copie.")
  for (const r of [r1, r2]) {
    if (r && !r.aEmail) avertissements.push(`${r.prenom} ${r.nom.toUpperCase()} n'a pas de courriel : pas de copie.`)
  }

  async function apercu() {
    const err = controlerSaisie(saisie, false)
    setErreurs(err)
    setSucces(null)
    if (err.length) return
    startTransition(async () => {
      const res = await fetch('/api/demande-accueil/apercu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saisie),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `Erreur ${res.status}` }))
        setErreurs([j.error ?? `Erreur ${res.status}`])
        return
      }
      setApercuUrl(URL.createObjectURL(await res.blob()))
    })
  }

  function envoyer() {
    const err = controlerSaisie(saisie, true)
    setErreurs(err)
    if (err.length) return
    const nb = saisie.destinataireIds.length
    if (!window.confirm(`Envoyer la demande à ${nb} destinataire(s) du Service des Piscines ?`)) return

    startTransition(async () => {
      const res = await envoyerDemande(saisie)
      if (res.ok) {
        setErreurs([])
        setApercuUrl(null)
        setSucces(`Demande envoyée à ${res.a?.join(', ')}${res.cc?.length ? ` — copie à ${res.cc.join(', ')}` : ''}.`)
      } else {
        setErreurs([res.error ?? 'Erreur'])
      }
      router.refresh()   // historique à jour (ENVOYEE ou ERREUR)
    })
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── La demande ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl p-5 flex flex-col gap-4" style={carteStyle}>
        <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>La demande</h2>

        <div>
          <Libelle requis>Type de demande</Libelle>
          <select value={saisie.typeDemandeId} onChange={e => maj({ typeDemandeId: e.target.value })}
            className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle}>
            {ctx.types.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Libelle requis>Jour souhaité</Libelle>
            <input type="date" value={saisie.dateSouhaitee} onChange={e => maj({ dateSouhaitee: e.target.value })}
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          </div>
          <div>
            <Libelle requis>Heure de début</Libelle>
            <input type="time" value={saisie.heureDebut} onChange={e => maj({ heureDebut: e.target.value })}
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          </div>
          <div>
            <Libelle requis>Heure de fin</Libelle>
            <input type="time" value={saisie.heureFin} onChange={e => maj({ heureFin: e.target.value })}
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChoixPersonne label="Responsable de l'accueil 1" requis
            adherents={ctx.adherents} valeur={saisie.responsable1Id} exclure={saisie.responsable2Id}
            onChange={id => maj({ responsable1Id: id })} />
          <ChoixPersonne label="Responsable de l'accueil 2 (facultatif)"
            adherents={ctx.adherents} valeur={saisie.responsable2Id} exclure={saisie.responsable1Id}
            onChange={id => maj({ responsable2Id: id })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Libelle requis>Nombre d&apos;adultes</Libelle>
            <input type="number" min={0} max={999} value={saisie.nbAdultes}
              onChange={e => maj({ nbAdultes: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          </div>
          <div>
            <Libelle requis>Nombre d&apos;enfants</Libelle>
            <input type="number" min={0} max={999} value={saisie.nbEnfants}
              onChange={e => maj({ nbEnfants: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          </div>
        </div>
      </section>

      {/* ── Coordonnées ────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4" style={carteStyle}>
        <div>
          <div className="text-[12px] text-slate-500">Président·e</div>
          <div className="text-[13px] font-medium mb-2" style={{ color: 'var(--csn-navy)' }}>
            {ctx.president ? `${ctx.president.prenom} ${ctx.president.nom.toUpperCase()}` : '—'}
            <span className="block text-[11px] font-normal text-slate-400">{ctx.president?.email ?? 'pas de courriel'}</span>
          </div>
          <Libelle requis>Téléphone du président·e</Libelle>
          <input type="tel" value={saisie.presidentTel} onChange={e => maj({ presidentTel: e.target.value })}
            className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
        </div>
        <div>
          <div className="text-[12px] text-slate-500">Responsable de la demande (vous)</div>
          <div className="text-[13px] font-medium mb-2" style={{ color: 'var(--csn-navy)' }}>
            {ctx.demandeur.prenomNom}
            <span className="block text-[11px] font-normal text-slate-400">{ctx.demandeur.email}</span>
          </div>
          <Libelle requis>Votre téléphone</Libelle>
          <input type="tel" value={saisie.demandeurTel} onChange={e => maj({ demandeurTel: e.target.value })}
            className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
        </div>
        <p className="sm:col-span-2 text-[11px] text-slate-400">
          Les téléphones sont mémorisés (chiffrés) après un envoi réussi et proposés la fois suivante.
        </p>
      </section>

      {/* ── Destinataires ──────────────────────────────────────────── */}
      <section className="bg-white rounded-xl p-5 flex flex-col gap-2" style={carteStyle}>
        <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>Destinataires (Service des Piscines)</h2>
        {ctx.destinataires.map(d => (
          <label key={d.id} className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: '#1a2e3f' }}>
            <input type="checkbox" checked={saisie.destinataireIds.includes(d.id)}
              onChange={e => maj({
                destinataireIds: e.target.checked
                  ? [...saisie.destinataireIds, d.id]
                  : saisie.destinataireIds.filter(x => x !== d.id),
              })} />
            <span>{d.prenom} {d.nom}</span>
            <span className="text-[11px] text-slate-400">{d.role ? `${d.role} — ` : ''}{d.email}</span>
          </label>
        ))}
        <p className="text-[11px] text-slate-400 mt-1">
          En copie : le président·e, les responsables de l&apos;accueil (s&apos;ils ont un courriel) et vous-même.
          La sélection est mémorisée pour le prochain envoi.
        </p>
      </section>

      {/* ── Messages ───────────────────────────────────────────────── */}
      {avertissements.length > 0 && (
        <div className="rounded-lg px-3 py-2 text-[12px] flex flex-col gap-1"
          style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {avertissements.map(a => <div key={a}>⚠ {a}</div>)}
        </div>
      )}
      {erreurs.length > 0 && (
        <div className="rounded-lg px-3 py-2 text-[12px] flex flex-col gap-1"
          style={{ background: '#fdecec', border: '0.5px solid #f3b4b4', color: '#9b1c1c' }}>
          {erreurs.map(e => <div key={e}>{e}</div>)}
        </div>
      )}
      {succes && (
        <div className="rounded-lg px-3 py-2 text-[12px]"
          style={{ background: '#eaf7f0', border: '0.5px solid #9fd8b9', color: '#1a6642' }}>
          ✓ {succes}
        </div>
      )}

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={apercu} disabled={isPending}
          className="px-4 py-2.5 rounded-lg text-[13px] border transition-colors hover:bg-slate-50 disabled:opacity-60"
          style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>
          {isPending ? 'Patientez…' : 'Aperçu PDF'}
        </button>
        <button onClick={envoyer} disabled={isPending || !ctx.smtp.verifie}
          className="px-4 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--csn-navy)' }}>
          Envoyer la demande →
        </button>
        {!ctx.smtp.verifie && (
          <span className="text-[12px]" style={{ color: '#7a5a00' }}>
            {ctx.smtp.configure ? 'Configuration SMTP non validée' : 'Aucune configuration SMTP'} :{' '}
            <a href="/config" className="underline">la configurer et la tester</a>.
          </span>
        )}
      </div>

      {apercuUrl && (
        <div className="bg-white rounded-xl overflow-hidden flex flex-col" style={carteStyle}>
          <div className="flex items-center px-4 py-2 text-[12px]" style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
            <span className="flex-1 text-slate-500">Aperçu — rien n&apos;est enregistré ni envoyé</span>
            <a href={apercuUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--csn-navy)' }}>
              Ouvrir dans un onglet
            </a>
          </div>
          <iframe src={apercuUrl} title="Aperçu de la demande" className="w-full" style={{ height: 820 }} />
        </div>
      )}

      <Historique lignes={ctx.historique} />
    </div>
  )
}

// ── Choix d'un adhérent (responsable de l'accueil) ───────────────────────────

function ChoixPersonne({ label, requis, adherents, valeur, exclure, onChange }: {
  label: string; requis?: boolean
  adherents: Personne[]; valeur: string; exclure: string
  onChange: (id: string) => void
}) {
  const [recherche, setRecherche] = useState('')
  const choisi = adherents.find(a => a.id === valeur)

  const q = norm(recherche)
  const suggestions = q.length < 2 ? [] : adherents
    .filter(a => a.id !== exclure)
    .filter(a => norm(`${a.prenom} ${a.nom}`).includes(q) || norm(`${a.nom} ${a.prenom}`).includes(q))
    .slice(0, 8)

  return (
    <div className="relative">
      <Libelle requis={requis}>{label}</Libelle>
      {choisi ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]" style={champStyle}>
          <span className="flex-1">{choisi.prenom} {choisi.nom.toUpperCase()}</span>
          <button onClick={() => onChange('')} className="text-[11px] text-slate-400 hover:text-slate-600">Changer</button>
        </div>
      ) : (
        <>
          <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Tapez un nom ou un prénom…"
            className="w-full px-3 py-2 text-[13px] rounded-lg outline-none" style={champStyle} />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg z-10 py-1"
              style={{ border: '0.5px solid var(--csn-border-strong)', boxShadow: '0 4px 16px rgba(26,58,92,0.08)' }}>
              {suggestions.map(a => (
                <li key={a.id}>
                  <button onClick={() => { onChange(a.id); setRecherche('') }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50" style={{ color: 'var(--csn-navy)' }}>
                    {a.prenom} {a.nom.toUpperCase()}
                    {!a.aEmail && <span className="text-[11px] text-slate-400"> — pas de courriel</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && suggestions.length === 0 && (
            <div className="text-[11px] text-slate-400 mt-1">Aucun adhérent de la saison ne correspond.</div>
          )}
        </>
      )}
    </div>
  )
}

// ── Historique de la saison ──────────────────────────────────────────────────

const STATUTS = {
  ENVOYEE:   { texte: 'Envoyée',   fond: '#eaf7f0', couleur: '#1a6642' },
  ERREUR:    { texte: 'Erreur',    fond: '#fdecec', couleur: '#9b1c1c' },
  BROUILLON: { texte: 'Brouillon', fond: '#f1f5f9', couleur: '#64748b' },
} as const

function fmtJour(iso: string): string {
  const [a, m, j] = iso.split('-')
  return `${j}/${m}/${a}`
}

function fmtDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Historique({ lignes }: { lignes: ContexteDemande['historique'] }) {
  return (
    <section className="bg-white rounded-xl p-5 flex flex-col gap-3" style={carteStyle}>
      <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>Historique de la saison</h2>
      {lignes.length === 0 ? (
        <div className="text-[12px] text-slate-400">Aucune demande pour l&apos;instant.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ color: '#1a2e3f' }}>
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-1 pr-3 font-normal">Jour souhaité</th>
                <th className="py-1 pr-3 font-normal">Type</th>
                <th className="py-1 pr-3 font-normal">Personnes</th>
                <th className="py-1 pr-3 font-normal">Statut</th>
                <th className="py-1 pr-3 font-normal">Par</th>
                <th className="py-1 font-normal">PDF</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => {
                const st = STATUTS[l.statut]
                return (
                  <tr key={l.id} style={{ borderTop: '0.5px solid var(--csn-border)' }}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {fmtJour(l.dateSouhaitee)}
                      <span className="text-slate-400"> {l.heureDebut}–{l.heureFin}</span>
                    </td>
                    <td className="py-1.5 pr-3">{l.type}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{l.nbAdultes} ad. / {l.nbEnfants} enf.</td>
                    <td className="py-1.5 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ background: st.fond, color: st.couleur }}
                        title={l.erreur ?? undefined}>
                        {st.texte}
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {fmtDateHeure(l.envoyeeLe ?? l.creeLe)}
                      </div>
                      {l.erreur && <div className="text-[11px]" style={{ color: '#9b1c1c' }}>{l.erreur}</div>}
                    </td>
                    <td className="py-1.5 pr-3">{l.envoyeePar}</td>
                    <td className="py-1.5">
                      {l.statut === 'ENVOYEE' && (
                        <a href={`/api/demande-accueil/${l.id}/pdf`} target="_blank" rel="noopener noreferrer"
                          className="underline" style={{ color: 'var(--csn-navy)' }}>
                          Voir
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
