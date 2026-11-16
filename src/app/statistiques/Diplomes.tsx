'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LabelList, Tooltip, Legend, Text,
} from 'recharts'
import { importerBrevets, type DiplomesData, type ImportBrevetsResult } from '@/app/actions/brevets'
import { classerBrevet, ORDRE_FAMILLES, type Famille } from '@/lib/brevets'
import { couleursSaisons } from './couleurs'

// ── Diplômes obtenus (brevets FFESSM) ────────────────────────────────────────
// Deux niveaux de lecture, même graphique :
//   Global  : une catégorie par FAMILLE (Plongée, Apnée…), une barre par saison
//   Famille : clic sur une famille → une catégorie par DIPLÔME de la famille
// Fil d'Ariane au-dessus (« Global › Plongée ») pour remonter.
// Saisons de la plus ancienne (bleu clair, à gauche) à la plus récente (bleu
// foncé) — même rampe que l'évolution des âges.
// Chiffres exacts (pas de masquage « < 5 ») : un brevet obtenu est une
// réussite affichée publiquement, comme dans la présentation de l'an dernier.

interface Ligne   { libelle: string; ordre: number; parSaison: Record<string, number> }
interface Groupe  { famille: Famille; lignes: Ligne[]; sousTotal: Record<string, number> }
// Ligne du graphique : s0, s1… = nombre pour la saison d'indice 0, 1…
type Point = { label: string } & Record<string, string | number>

export default function Diplomes({ data }: { data: DiplomesData }) {
  // Ordre chronologique (ancienne → récente) pour les barres et les couleurs
  const saisons  = data.saisons.map(s => s.saison).sort()
  const couleurs = couleursSaisons(saisons.length)
  const [famille, setFamille] = useState<Famille | null>(null)

  const groupes = useMemo<Groupe[]>(() => {
    const parFamille = new Map<Famille, Map<string, Ligne>>()
    for (const l of data.lignes) {
      const c = classerBrevet(l.niveau)
      const lignes = parFamille.get(c.famille) ?? new Map<string, Ligne>()
      parFamille.set(c.famille, lignes)
      // Plusieurs libellés FFESSM peuvent donner le même libellé court : cumulés
      const ligne = lignes.get(c.libelle) ?? { libelle: c.libelle, ordre: c.ordre, parSaison: {} }
      lignes.set(c.libelle, ligne)
      ligne.parSaison[l.saison] = (ligne.parSaison[l.saison] ?? 0) + l.count
    }
    return ORDRE_FAMILLES
      .filter(f => parFamille.has(f))
      .map(famille => {
        const lignes = Array.from(parFamille.get(famille)!.values())
          .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr', { numeric: true }))
        const sousTotal: Record<string, number> = {}
        for (const l of lignes) for (const [s, n] of Object.entries(l.parSaison)) sousTotal[s] = (sousTotal[s] ?? 0) + n
        return { famille, lignes, sousTotal }
      })
  }, [data.lignes])

  // Famille choisie disparue (réimport) → retour au global
  const groupe = famille ? groupes.find(g => g.famille === famille) ?? null : null

  const enPoints = (items: { label: string; parSaison: Record<string, number> }[]): Point[] =>
    items.map(it => {
      const p: Point = { label: it.label }
      saisons.forEach((s, i) => { p[`s${i}`] = it.parSaison[s] ?? 0 })
      return p
    })

  const points = groupe
    ? enPoints(groupe.lignes.map(l => ({ label: l.libelle, parSaison: l.parSaison })))
    : enPoints(groupes.map(g => ({ label: g.famille, parSaison: g.sousTotal })))

  const totaux: Record<string, number> = groupe
    ? groupe.sousTotal
    : Object.fromEntries(data.saisons.map(s => [s.saison, s.total]))

  if (saisons.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="py-16 text-center text-[13px] text-slate-400">
          Aucune liste de brevets importée. Utilisez le bloc ci-dessous avec l&apos;export FFESSM
          « Liste des brevets » d&apos;une saison.
        </div>
        <ImportBrevets />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        {/* ── Fil d'Ariane + totaux du niveau affiché ───────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <nav className="flex items-center gap-1.5 text-[14px]" aria-label="Niveau de détail">
            {groupe ? (
              <>
                <button type="button" onClick={() => setFamille(null)}
                  className="px-2 py-0.5 rounded-md underline-offset-2 hover:underline"
                  style={{ color: 'var(--csn-blue)' }}>
                  Global
                </button>
                <span className="text-slate-400" aria-hidden>›</span>
                <span className="px-2 py-0.5 rounded-md font-medium"
                  style={{ background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
                  aria-current="page">
                  {groupe.famille}
                </span>
              </>
            ) : (
              <span className="px-2 py-0.5 rounded-md font-medium"
                style={{ background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
                aria-current="page">
                Global
              </span>
            )}
          </nav>
          <div className="text-[13px] text-slate-500">
            {groupe ? `Total ${groupe.famille.toLowerCase()}` : 'Total'} :{' '}
            {saisons.map(s => `${s} : ${totaux[s] ?? 0}`).join(' · ')}
          </div>
        </div>

        {/* ── Histogramme ───────────────────────────────────────────────── */}
        <div className="h-[520px]" style={{ cursor: groupe ? 'default' : 'pointer' }}>
          <ResponsiveContainer width="100%" height="100%">
            {/* key : nouveau graphique à chaque changement de niveau, sinon
                l'infobulle garde le libellé de la famille cliquée. */}
            <BarChart key={groupe?.famille ?? 'global'} data={points}
              margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
              barGap={2} barCategoryGap="22%"
              onClick={(etat: { activeLabel?: string } | null) => {
                // Clic n'importe où dans la colonne d'une famille → détail
                if (!groupe && etat?.activeLabel) setFamille(etat.activeLabel as Famille)
              }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
                interval={0} height={groupe ? 64 : 40} tick={<TickMultiligne />} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false}
                tick={{ fontSize: 13, fill: '#94a3b8' }} />
              <Tooltip
                cursor={{ fill: 'rgba(46,109,164,0.06)' }}
                labelFormatter={(l: string) => (groupe ? l : `${l} — cliquez pour le détail`)}
                formatter={(v: number, n: string) => [`${v} brevet${v > 1 ? 's' : ''}`, n]}
              />
              {/* Texte de légende en gris foncé : le bleu clair seul est peu
                  lisible ; la pastille porte la couleur de la saison. */}
              <Legend iconType="circle" wrapperStyle={{ fontSize: 16 }}
                formatter={(v: string) => <span style={{ color: '#475569' }}>{v}</span>} />
              {saisons.map((s, i) => (
                <Bar key={s} dataKey={`s${i}`} name={s} fill={couleurs[i]} radius={[4, 4, 0, 0]}
                  maxBarSize={64}>
                  <LabelList dataKey={`s${i}`} position="top" formatter={(v: number) => (v ? String(v) : '')}
                    style={{ fontSize: 14, fill: '#475569' }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[12px] text-slate-400 text-center">
          {groupe
            ? <>Détail de la famille « {groupe.famille} ». Revenez à la vue d&apos;ensemble avec « Global ».</>
            : <>Cliquez sur une famille pour voir le détail de ses diplômes.</>}
          <br />
          Source : export FFESSM « Liste des brevets » (saison FFESSM indiquée dans le fichier) —{' '}
          {data.saisons.map(s => `${s.saison} importée le ${s.importeLe}`).join(' · ')}.
        </p>
      </div>

      <ImportBrevets />
    </div>
  )
}

// Libellé d'abscisse sur plusieurs lignes : les noms de diplômes sont longs
// (« Apnéiste confirmé Piscine (Indoor 2 CMAS) »). Largeur = part de l'axe
// revenant à chaque catégorie.
function TickMultiligne(props: {
  x?: number; y?: number; width?: number; visibleTicksCount?: number; payload?: { value?: string }
}) {
  const { x = 0, y = 0, width = 0, visibleTicksCount = 1, payload } = props
  const largeur = Math.max(60, width / Math.max(1, visibleTicksCount) - 8)
  return (
    <Text x={x} y={y + 4} width={largeur} textAnchor="middle" verticalAnchor="start"
      style={{ fontSize: 14, fill: '#475569' }}>
      {payload?.value ?? ''}
    </Text>
  )
}

// ── Import d'un export « Liste des brevets » ─────────────────────────────────

function ImportBrevets() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fichier, setFichier] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [resultat, setResultat] = useState<ImportBrevetsResult | null>(null)

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnCours(true)
    setResultat(null)
    try {
      const res = await importerBrevets(new FormData(e.currentTarget))
      setResultat(res)
      if (res.success) {
        setFichier(null)
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()                    // recharge le tableau avec la nouvelle saison
      }
    } catch (err) {
      setResultat({ success: false, error: String(err) })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={envoyer} className="rounded-lg p-4 flex flex-col gap-3"
      style={{ border: '0.5px dashed var(--csn-border-strong)' }}>
      <div className="text-[12px] text-slate-500">
        Importer une liste des brevets (export FFESSM, une saison par fichier).
        La saison est lue dans le fichier ; si elle est déjà importée, ses brevets sont remplacés.
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div
          className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)' }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-[13px] flex-1 truncate"
            style={{ color: fichier ? 'var(--csn-navy)' : '#94a3b8' }}>
            {fichier ?? 'Cliquez pour sélectionner ListeBrevets….xlsx'}
          </span>
        </div>
        <input ref={inputRef} type="file" name="brevets" accept=".xlsx,.xls" className="hidden"
          onChange={e => { setFichier(e.target.files?.[0]?.name ?? null); setResultat(null) }} />
        <button type="submit" disabled={!fichier || enCours}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--csn-navy)' }}>
          {enCours ? 'Import en cours…' : 'Importer'}
        </button>
      </div>

      {resultat && (
        <div className="text-[12px] rounded-lg px-3 py-2"
          style={resultat.success
            ? { background: '#eaf7f0', color: '#1a6642' }
            : { background: '#fff3cd', color: '#7a5a00' }}>
          {resultat.success
            ? <>Saison {resultat.saison} : {resultat.nb} brevet(s) importé(s)
                {resultat.remplaces ? ` (remplacent les ${resultat.remplaces} précédents)` : ''}.</>
            : resultat.error}
          {resultat.erreurs && resultat.erreurs.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {resultat.erreurs.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
