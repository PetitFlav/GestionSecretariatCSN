'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ajouterDiplome, getAdherentsPourDiplome, type AdherentDiplome } from '@/app/actions/brevets'
import { classerBrevet, cleNiveau, nettoyerNiveau, FAMILLE_AUTRES } from '@/lib/brevets'

// ── Ajout manuel d'un diplôme, rattaché à un adhérent ────────────────────────
// 1. Saison (table saisons) → charge ses adhérents actifs (invités exclus)
// 2. Adhérent : recherche par nom / prénom / licence dans cette saison
// 3. Diplôme : texte libre, avec proposition des libellés déjà en base qui
//    COMMENCENT par la saisie (accents et majuscules ignorés)
// 4. Catégorie (famille des stats) : obligatoire, pré-remplie d'après le
//    diplôme (dernière catégorie choisie pour lui, sinon règles de
//    lib/brevets.ts) ; mêmes propositions « commence par » que le diplôme,
//    on peut aussi en taper une nouvelle
// 5. Date d'obtention facultative
// Après un ajout, saison, diplôme et date sont gardés : on enchaîne les
// adhérents d'une même session d'examen.

export interface SaisonOption { id: string; label: string; isActive: boolean }

const champStyle = {
  border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)',
}
const champClasse = 'w-full px-3 py-2 text-[13px] rounded-lg outline-none'

const MAX_ADHERENTS = 10
const MAX_DIPLOMES  = 8

export default function SaisieDiplome({ saisons, niveaux, familles, famillesChoisies }: {
  saisons:          SaisonOption[]
  niveaux:          string[]                // libellés de diplômes en base
  familles:         string[]                // catégories proposées
  famillesChoisies: Record<string, string>  // diplôme → dernière catégorie saisie
}) {
  const router = useRouter()
  const [saisonId, setSaisonId]   = useState(saisons.find(s => s.isActive)?.id ?? saisons[0]?.id ?? '')
  const [adherents, setAdherents] = useState<AdherentDiplome[] | null>(null)   // null = chargement
  const [recherche, setRecherche] = useState('')
  const [adherent, setAdherent]   = useState<AdherentDiplome | null>(null)
  const [niveau, setNiveau]       = useState('')
  // null = catégorie automatique (suit le diplôme) ; texte = modifiée à la main
  const [familleSaisie, setFamilleSaisie] = useState<string | null>(null)
  const [date, setDate]           = useState('')
  const [resultat, setResultat]   = useState<{ ok: boolean; texte: string } | null>(null)
  const [enCours, startTransition] = useTransition()

  // Changement de saison → on recharge ses adhérents et on oublie le choix
  useEffect(() => {
    let annule = false
    setAdherents(null)
    setAdherent(null)
    setRecherche('')
    if (!saisonId) { setAdherents([]); return }
    getAdherentsPourDiplome(saisonId)
      .then(liste => { if (!annule) setAdherents(liste) })
      .catch(() => { if (!annule) setAdherents([]) })
    return () => { annule = true }
  }, [saisonId])

  // Tous les mots tapés doivent se retrouver dans « nom prénom licence »
  const adherentsProposes = useMemo(() => {
    const mots = cleNiveau(recherche).split(' ').filter(Boolean)
    if (!adherents || mots.length === 0) return []
    return adherents
      .filter(a => {
        const texte = cleNiveau(`${a.nom} ${a.prenom} ${a.licence ?? ''}`)
        return mots.every(m => texte.includes(m))
      })
      .slice(0, MAX_ADHERENTS)
  }, [adherents, recherche])

  // Libellés existants qui commencent par la saisie
  const debut = cleNiveau(niveau)
  const diplomesProposes = useMemo(() => {
    if (!debut) return []
    const liste = niveaux.filter(n => cleNiveau(n).startsWith(debut))
    // Saisie déjà identique à l'unique proposition : rien à proposer
    if (liste.length === 1 && cleNiveau(liste[0]) === debut) return []
    return liste.slice(0, MAX_DIPLOMES)
  }, [niveaux, debut])

  const libelleExistant = niveaux.find(n => cleNiveau(n) === debut)
  const classe = debut ? classerBrevet(nettoyerNiveau(niveau)) : null

  // Catégorie pré-remplie : dernière choisie pour ce diplôme, sinon la règle
  // (sauf « Autres » : diplôme inconnu → à taper)
  const familleAuto = !classe ? ''
    : (libelleExistant && famillesChoisies[libelleExistant])
      || (classe.famille !== FAMILLE_AUTRES ? classe.famille : '')
  const familleValeur = familleSaisie ?? familleAuto
  const cleFamille = cleNiveau(familleValeur)
  const familleExistante = familles.find(f => cleNiveau(f) === cleFamille)
  const famillesProposees = useMemo(() => {
    const liste = familles.filter(f => cleNiveau(f).startsWith(cleFamille))
    if (liste.length === 1 && cleNiveau(liste[0]) === cleFamille) return []
    return liste
  }, [familles, cleFamille])

  // Nouveau diplôme tapé ou choisi → la catégorie redevient automatique
  function changerNiveau(v: string) {
    setNiveau(v)
    setFamilleSaisie(null)
    setResultat(null)
  }

  function enregistrer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!adherent || !debut || !cleFamille) return
    // Même libellé à la casse / aux accents près → on garde celui de la base,
    // pour ne pas créer deux variantes d'un même diplôme.
    const libelle = libelleExistant ?? nettoyerNiveau(niveau)
    const famille = familleExistante ?? nettoyerNiveau(familleValeur)
    startTransition(async () => {
      try {
        const res = await ajouterDiplome({ saisonId, adherentId: adherent.id, niveau: libelle, famille, dateObtention: date })
        if (res.success) {
          setResultat({ ok: true, texte: res.message ?? 'Diplôme ajouté.' })
          setNiveau(libelle)
          setFamilleSaisie(famille)
          setAdherent(null)
          setRecherche('')
          router.refresh()   // le nouveau libellé rejoint les propositions
        } else {
          setResultat({ ok: false, texte: res.error ?? 'Erreur' })
        }
      } catch (err) {
        setResultat({ ok: false, texte: String(err) })
      }
    })
  }

  if (saisons.length === 0) {
    return <p className="text-[13px] text-slate-500">Aucune saison en base : créez-en une dans Gestion des saisons.</p>
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-4">

      {/* ── Saison ─────────────────────────────────────────────────── */}
      <div>
        <Libelle htmlFor="saison" requis>Saison</Libelle>
        <select id="saison" value={saisonId} onChange={e => { setSaisonId(e.target.value); setResultat(null) }}
          className={champClasse} style={champStyle}>
          {saisons.map(s => (
            <option key={s.id} value={s.id}>{s.label}{s.isActive ? ' (active)' : ''}</option>
          ))}
        </select>
      </div>

      {/* ── Adhérent ───────────────────────────────────────────────── */}
      <div>
        <Libelle htmlFor="adherent" requis>Adhérent</Libelle>
        {adherent ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={champStyle}>
            <span className="flex-1 text-[13px]">
              {adherent.nom} {adherent.prenom}
              <span className="text-slate-400"> · {adherent.licence || 'sans licence'}</span>
            </span>
            <button type="button" onClick={() => { setAdherent(null); setRecherche('') }}
              className="text-[12px] underline text-slate-500 hover:text-slate-700">
              Changer
            </button>
          </div>
        ) : (
          <>
            <ChampSuggestions
              id="adherent"
              valeur={recherche}
              onSaisie={v => { setRecherche(v); setResultat(null) }}
              suggestions={adherentsProposes}
              cleDe={a => a.id}
              rendu={a => <>{a.nom} {a.prenom}<span className="text-slate-400"> · {a.licence || 'sans licence'}</span></>}
              onChoix={a => { setAdherent(a); setRecherche('') }}
              placeholder={adherents === null ? 'Chargement des adhérents…' : 'Nom, prénom ou n° de licence'}
              disabled={adherents === null}
            />
            {adherents && adherents.length === 0 && (
              <Aide>Aucun adhérent actif dans cette saison.</Aide>
            )}
            {adherents && adherents.length > 0 && recherche.trim() && adherentsProposes.length === 0 && (
              <Aide>Aucun adhérent actif de la saison ne correspond.</Aide>
            )}
          </>
        )}
      </div>

      {/* ── Diplôme ────────────────────────────────────────────────── */}
      <div>
        <Libelle htmlFor="diplome" requis>Diplôme</Libelle>
        <ChampSuggestions
          id="diplome"
          valeur={niveau}
          onSaisie={changerNiveau}
          suggestions={diplomesProposes}
          cleDe={n => n}
          rendu={n => <>{n}</>}
          onChoix={changerNiveau}
          placeholder="Ex. Niveau 1, RIFA Plongée…"
        />
        {classe && !libelleExistant && (
          <Aide>Nouveau libellé : il sera proposé aux prochaines saisies.</Aide>
        )}
      </div>

      {/* ── Catégorie + date ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-4">
        <div>
          <Libelle htmlFor="categorie" requis>Catégorie</Libelle>
          <ChampSuggestions
            id="categorie"
            valeur={familleValeur}
            onSaisie={v => { setFamilleSaisie(v); setResultat(null) }}
            suggestions={famillesProposees}
            cleDe={f => f}
            rendu={f => <>{f}</>}
            onChoix={f => setFamilleSaisie(f)}
            placeholder="Ex. Plongée, Pêche sous-marine…"
          />
          {classe && cleFamille && (
            <Aide>
              {familleExistante ? '' : 'Nouvelle catégorie — '}
              Compté dans les statistiques en « {familleExistante ?? nettoyerNiveau(familleValeur)} › {classe.libelle} ».
            </Aide>
          )}
          {classe && !cleFamille && (
            <Aide>Diplôme non reconnu : choisissez ou saisissez sa catégorie.</Aide>
          )}
        </div>
        <div>
          <Libelle htmlFor="date">Date d&apos;obtention</Libelle>
          <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)}
            className={champClasse} style={champStyle} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button type="submit" disabled={!adherent || !debut || !cleFamille || enCours}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--csn-navy)' }}>
          {enCours ? 'Enregistrement…' : 'Ajouter le diplôme'}
        </button>
        {resultat && (
          <div className="flex-1 text-[12px] rounded-lg px-3 py-2"
            style={resultat.ok
              ? { background: '#eaf7f0', color: '#1a6642' }
              : { background: '#fff3cd', color: '#7a5a00' }}>
            {resultat.texte}
          </div>
        )}
      </div>
    </form>
  )
}

// ── Petits composants ────────────────────────────────────────────────────────

function Libelle({ htmlFor, requis, children }: { htmlFor: string; requis?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] text-slate-500 mb-1">
      {children}{requis && <span className="text-red-500"> *</span>}
    </label>
  )
}

function Aide({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-slate-400">{children}</p>
}

/**
 * Champ texte avec liste de propositions sous la saisie.
 * Clavier : ↑ ↓ pour se déplacer, Entrée pour choisir, Échap pour fermer.
 */
function ChampSuggestions<T>({ id, valeur, onSaisie, suggestions, cleDe, rendu, onChoix, placeholder, disabled }: {
  id:           string
  valeur:       string
  onSaisie:     (v: string) => void
  suggestions:  T[]
  cleDe:        (s: T) => string
  rendu:        (s: T) => React.ReactNode
  onChoix:      (s: T) => void
  placeholder?: string
  disabled?:    boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif]   = useState(0)
  const visibles = ouvert ? suggestions : []
  const iActif   = Math.min(actif, visibles.length - 1)

  function choisir(s: T) {
    onChoix(s)
    setOuvert(false)
  }

  function clavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (visibles.length === 0) return
    if (e.key === 'ArrowDown')    { e.preventDefault(); setActif((iActif + 1) % visibles.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((iActif - 1 + visibles.length) % visibles.length) }
    else if (e.key === 'Enter')   { e.preventDefault(); choisir(visibles[iActif]) }
    else if (e.key === 'Escape')  { setOuvert(false) }
  }

  return (
    <div className="relative">
      <input id={id} value={valeur} placeholder={placeholder} disabled={disabled} autoComplete="off"
        role="combobox" aria-expanded={visibles.length > 0} aria-controls={`${id}-liste`}
        onChange={e => { onSaisie(e.target.value); setOuvert(true); setActif(0) }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onKeyDown={clavier}
        className={`${champClasse} disabled:opacity-60`} style={champStyle} />
      {visibles.length > 0 && (
        <ul id={`${id}-liste`} role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-lg shadow-lg max-h-64 overflow-auto py-1"
          style={{ border: '0.5px solid var(--csn-border-strong)' }}>
          {visibles.map((s, i) => (
            <li key={cleDe(s)} role="option" aria-selected={i === iActif}
              // mousedown (et non click) : passe AVANT le blur qui ferme la liste
              onMouseDown={e => { e.preventDefault(); choisir(s) }}
              onMouseEnter={() => setActif(i)}
              className="px-3 py-1.5 text-[13px] cursor-pointer"
              style={{ color: 'var(--csn-navy)', ...(i === iActif ? { background: 'var(--csn-light)' } : {}) }}>
              {rendu(s)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
