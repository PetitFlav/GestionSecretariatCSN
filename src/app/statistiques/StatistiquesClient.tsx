'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  Tooltip, Legend,
} from 'recharts'
import type { StatsData, StatLigne, StatReinscription, TypeReinscription } from '@/app/actions/statistiques'
import { SEXE_LABEL, type Sexe } from '@/lib/sexe'
import { TRANCHE_LABEL, ORDRE_TRANCHES, type TrancheId } from '@/lib/ages'

// ── Réglages ─────────────────────────────────────────────────────────────────

// Catalogue des statistiques — ajouter une entrée ici + son rendu plus bas.
const STATS = [
  { id: 'sexe', label: 'Répartition femmes / hommes' },
  { id: 'age',  label: "Répartition par tranche d'âge" },
  { id: 'reinscription', label: 'Taux de réinscription' },
  { id: 'composition',   label: 'Sections : anciens / nouveaux' },
] as const
type StatId = typeof STATS[number]['id']

type Mode = 'saison' | 'evolution'

const TOUTES = '__toutes__'
const SANS_SECTION = '__sans__'

// Couleurs validées (contraste + daltonisme) — orange / bleu, gris pour NR.
// Volontairement pas rose/bleu : lisible au vidéoprojecteur et sans cliché.
const COULEUR: Record<Sexe, string> = {
  F:  '#eb6834',
  H:  '#2a78d6',
  NR: '#94a3b8',
}
const ORDRE_SEXE: Sexe[] = ['F', 'H', 'NR']

// Réinscription — palette validée (contraste + daltonisme). Le vert passe
// sous 3:1 sur blanc : compensé par les chiffres écrits sur chaque segment.
const COULEUR_REINSC: Record<TypeReinscription, string> = {
  REINSCRIT: '#2a78d6',
  NOUVEAU:   '#1baf7a',
  PARTI:     '#eb6834',
}
const LABEL_REINSC: Record<TypeReinscription, string> = {
  REINSCRIT: 'Réinscrits',
  NOUVEAU:   'Nouveaux',
  PARTI:     'Non réinscrits',
}

// Âges — une saison : un seul bleu (une seule série), gris pour NR.
const COULEUR_AGE    = '#2a78d6'
const COULEUR_AGE_NR = '#94a3b8'
// Âges — évolution : une couleur par saison, du plus clair (ancienne) au plus
// foncé (récente), même teinte : la lecture « avant → maintenant » est immédiate.
const RAMPE_SAISONS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
function couleursSaisons(n: number): string[] {
  // Répartit les n saisons sur toute la rampe : avec 2 saisons on obtient le
  // plus clair et le plus foncé (bien distincts), jamais deux bleus voisins.
  if (n <= 1) return [RAMPE_SAISONS[RAMPE_SAISONS.length - 1]]
  const L = RAMPE_SAISONS.length
  return Array.from({ length: n }, (_, i) =>
    RAMPE_SAISONS[Math.min(L - 1, Math.round((i * (L - 1)) / (n - 1)))])
}

// ── Petits helpers ───────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  if (!total) return '0 %'
  return `${Math.round((n / total) * 100)} %`
}

// ── Petits effectifs (confidentialité) — STAT ÂGES UNIQUEMENT ───────────────
// La stat femmes / hommes garde volontairement les chiffres exacts (plus
// lisible en AG). Pour les âges, plus identifiants, un groupe de 1 à 4
// personnes est affiché « < 5 », sans pourcentage : devant
// la salle, « 2 femmes en Hockey 50–59 » identifie quelqu'un. Les barres
// concernées sont dessinées à la hauteur du seuil, en pointillés pâles, pour
// que leur taille ne trahisse pas le chiffre exact.
// Le TOTAL général reste exact (il n'identifie personne).
const SEUIL = 5

function masque(n: number): boolean { return n > 0 && n < SEUIL }

/** Effectif affiché : « < 5 » pour un petit groupe. */
function nb(n: number): string { return masque(n) ? `< ${SEUIL}` : String(n) }

/** Effectif + pourcentage, sans pourcentage pour un petit groupe. */
function nbPct(n: number, total: number): string {
  return masque(n) ? `< ${SEUIL}` : `${n} (${pct(n, total)})`
}

/** Hauteur de barre : plafonnée au seuil pour un petit groupe. */
function hauteur(n: number): number { return masque(n) ? SEUIL : n }

/** Style de la barre masquée : même couleur, pâle, contour pointillé. */
function styleMasque(couleur: string) {
  return { fill: couleur, fillOpacity: 0.3, stroke: couleur, strokeWidth: 1.5, strokeDasharray: '4 3' }
}

function NoteSeuil() {
  return (
    <span>Les groupes de moins de {SEUIL} personnes sont affichés « &lt; {SEUIL} » (barres en pointillés).</span>
  )
}

function filtreSection(l: StatLigne, section: string): boolean {
  if (section === TOUTES)       return true
  if (section === SANS_SECTION) return l.section === null
  return l.section === section
}

// ── Composant ────────────────────────────────────────────────────────────────

export default function StatistiquesClient({ data }: { data: StatsData }) {
  const { saisons, lignes, reinscriptions } = data
  const active = saisons.find(s => s.isActive) ?? saisons[saisons.length - 1]

  const [stat,     setStat]     = useState<StatId>('sexe')
  const [modeChoisi, setMode]   = useState<Mode>('saison')
  // « Anciens / nouveaux par section » : vue d'une saison uniquement pour
  // l'instant (une seule saison a des sections). L'évolution viendra en 2028.
  const mode: Mode = stat === 'composition' ? 'saison' : modeChoisi
  const [saisonId, setSaisonId] = useState(active.id)
  const [section,  setSection]  = useState<string>(TOUTES)

  const saison = saisons.find(s => s.id === saisonId) ?? active

  // Liste des sections connues (toutes saisons confondues)
  const sections = useMemo(() => {
    const set = new Set<string>()
    let sansSection = false
    const avecSect = new Set(saisons.filter(s => s.hasSections).map(s => s.id))
    for (const l of lignes) {
      if (l.section) set.add(l.section)
      // « Sans section » n'a de sens que dans une saison où les sections existent
      else if (avecSect.has(l.saisonId)) sansSection = true
    }
    return { liste: Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')), sansSection }
  }, [lignes, saisons])

  // Section grisée : saison sans sections (mode saison) ou aucune saison
  // n'en a (mode évolution).
  // Réinscription : la section n'a de sens que si les DEUX saisons comparées
  // en ont (sinon les non-réinscrits n'ont pas de section connue).
  const aSections = (id: string) => saisons.find(s => s.id === id)?.hasSections ?? false
  const reinscSaison = reinscriptions.find(r => r.saisonId === saison.id) ?? null
  const sectionDisabled = stat === 'composition'
    ? true                                   // la vue EST déjà découpée par section
    : stat === 'reinscription'
    ? (mode === 'saison'
        ? !(reinscSaison && aSections(reinscSaison.saisonId) && aSections(reinscSaison.precedentId))
        : !(reinscriptions.length > 0 && reinscriptions.every(r => aSections(r.saisonId) && aSections(r.precedentId))))
    : mode === 'saison'
      ? !saison.hasSections
      : !saisons.some(s => s.hasSections)
  const sectionEff = sectionDisabled ? TOUTES : section

  // ── Données camembert (une saison) ─────────────────────────────────────────
  const camembert = useMemo(() => {
    const tot: Record<Sexe, number> = { F: 0, H: 0, NR: 0 }
    for (const l of lignes) {
      if (l.saisonId === saison.id && filtreSection(l, sectionEff)) tot[l.sexe] += l.count
    }
    const total = tot.F + tot.H + tot.NR
    const parts = ORDRE_SEXE
      .filter(s => tot[s] > 0)
      .map(s => ({ sexe: s, name: SEXE_LABEL[s], value: tot[s] }))
    return { parts, total, tot }
  }, [lignes, saison.id, sectionEff])

  // ── Données histogramme (évolution) ────────────────────────────────────────
  const evolution = useMemo(() => {
    // Avec un filtre de section, une saison sans sections afficherait 0 :
    // ce serait faux, donc on l'écarte et on le signale.
    const exclues: string[] = []
    const rows = saisons.flatMap(s => {
      if (sectionEff !== TOUTES && !s.hasSections) { exclues.push(s.label); return [] }
      const r = { label: s.label, F: 0, H: 0, NR: 0 }
      for (const l of lignes) {
        if (l.saisonId === s.id && filtreSection(l, sectionEff)) r[l.sexe] += l.count
      }
      return [r]
    })
    const avecNR = rows.some(r => r.NR > 0)
    return { rows, exclues, avecNR }
  }, [lignes, saisons, sectionEff])

  // ── Données âges (une saison) ──────────────────────────────────────────────
  const ages = useMemo(() => {
    const tot = Object.fromEntries(ORDRE_TRANCHES.map(t => [t, 0])) as Record<TrancheId, number>
    for (const l of lignes) {
      if (l.saisonId === saison.id && filtreSection(l, sectionEff)) tot[l.tranche] += l.count
    }
    const total = ORDRE_TRANCHES.reduce((n, t) => n + tot[t], 0)
    const rows = ORDRE_TRANCHES
      .filter(t => t !== 'NR' || tot.NR > 0)          // NR seulement s'il existe
      .map(t => ({ tranche: t, label: TRANCHE_LABEL[t], value: tot[t] }))
    return { rows, total, nr: tot.NR }
  }, [lignes, saison.id, sectionEff])

  // ── Données âges (évolution) : x = tranche, une barre par saison ──────────
  const agesEvo = useMemo(() => {
    const exclues: string[] = []
    const retenues = saisons.filter(s => {
      if (sectionEff !== TOUTES && !s.hasSections) { exclues.push(s.label); return false }
      return true
    })
    const totParSaison: Record<string, number> = {}
    const rows = ORDRE_TRANCHES.map(t => {
      const r: Record<string, string | number> = { tranche: t, label: TRANCHE_LABEL[t] }
      for (const s of retenues) r[s.id] = 0
      return r
    })
    for (const l of lignes) {
      if (!retenues.some(s => s.id === l.saisonId) || !filtreSection(l, sectionEff)) continue
      const r = rows[ORDRE_TRANCHES.indexOf(l.tranche)]
      r[l.saisonId] = (r[l.saisonId] as number) + l.count
      totParSaison[l.saisonId] = (totParSaison[l.saisonId] ?? 0) + l.count
    }
    const avecNR = retenues.some(s => (rows[rows.length - 1][s.id] as number) > 0)
    return {
      rows: avecNR ? rows : rows.slice(0, -1),
      series: retenues.map(s => ({ id: s.id, label: s.label })),
      totParSaison,
      exclues,
    }
  }, [lignes, saisons, sectionEff])

  const libelleSection =
    sectionEff === TOUTES ? 'toutes sections'
    : sectionEff === SANS_SECTION ? 'sans section'
    : sectionEff

  const labelSaison = (id: string) => saisons.find(s => s.id === id)?.label ?? '?'
  const nomStat = stat === 'sexe' ? 'Femmes / hommes'
    : stat === 'age' ? "Tranches d'âge"
    : 'Réinscription'
  const titre =
    stat === 'composition'
      ? `Anciens et nouveaux par section — ${saison.label}`
    : stat === 'reinscription' && mode === 'saison'
      ? (reinscSaison
          ? `Réinscription — ${labelSaison(reinscSaison.precedentId)} → ${saison.label} (${libelleSection})`
          : `Réinscription — ${saison.label}`)
    : mode === 'saison'
      ? `${nomStat} — ${saison.label} (${libelleSection})`
      : `Évolution ${nomStat.toLowerCase()} par saison (${libelleSection})`


  return (
    <div className="flex flex-col gap-4">

      {/* ── Grande zone graphique ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-5"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>
        <h2 className="text-[17px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
          {titre}
        </h2>

        {stat === 'sexe' && mode === 'saison' && (
          <Camembert parts={camembert.parts} total={camembert.total} tot={camembert.tot} />
        )}

        {stat === 'sexe' && mode === 'evolution' && (
          <Histogramme rows={evolution.rows} avecNR={evolution.avecNR} exclues={evolution.exclues} />
        )}

        {stat === 'age' && mode === 'saison' && (
          <AgeSaison rows={ages.rows} total={ages.total} nr={ages.nr} pivot={saison.dateDebut} />
        )}

        {stat === 'age' && mode === 'evolution' && (
          <AgeEvolution rows={agesEvo.rows} series={agesEvo.series}
            totParSaison={agesEvo.totParSaison} exclues={agesEvo.exclues} />
        )}

        {stat === 'reinscription' && mode === 'saison' && (
          reinscSaison
            ? <ReinscriptionSaison r={reinscSaison} section={sectionEff}
                labelP={labelSaison(reinscSaison.precedentId)} labelN={saison.label}
                provisoire={saison.isActive} />
            : <Vide texte="Pas de saison précédente en base : la réinscription ne peut pas être calculée pour cette saison." />
        )}

        {stat === 'composition' && (
          !reinscSaison
            ? <Vide texte="Pas de saison précédente en base : impossible de distinguer anciens et nouveaux pour cette saison." />
            : !saison.hasSections
              ? <Vide texte="Pas de sections enregistrées pour cette saison." />
              : <CompositionSections r={reinscSaison}
                  labelP={labelSaison(reinscSaison.precedentId)} labelN={saison.label}
                  provisoire={saison.isActive} />
        )}

        {stat === 'reinscription' && mode === 'evolution' && (
          <ReinscriptionEvolution reinscriptions={reinscriptions} section={sectionEff}
            labelSaison={labelSaison} />
        )}

      </div>

      {/* ── Bandeau de filtres ────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>

        <Filtre label="Statistique">
          <select value={stat} onChange={e => setStat(e.target.value as StatId)}
            className={selectCls} style={selectStyle}>
            {STATS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Filtre>

        <Filtre label="Affichage"
          hint={stat === 'composition' ? "Évolution disponible quand deux saisons consécutives auront des sections." : undefined}>
          <select value={mode} onChange={e => setMode(e.target.value as Mode)}
            disabled={stat === 'composition'}
            className={selectCls} style={selectStyle}>
            <option value="saison">Saison choisie</option>
            <option value="evolution">Évolution année par année</option>
          </select>
        </Filtre>

        <Filtre label="Saison"
          hint={mode === 'evolution' ? 'Toutes les saisons sont affichées en mode évolution.' : undefined}>
          <select value={saison.id} onChange={e => setSaisonId(e.target.value)}
            disabled={mode === 'evolution'}
            className={selectCls} style={selectStyle}>
            {[...saisons].reverse().map(s => (
              <option key={s.id} value={s.id}>
                {s.label}{s.isActive ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </Filtre>

        <Filtre label="Section"
          hint={stat === 'composition' ? 'Cette vue affiche déjà toutes les sections.'
            : sectionDisabled ? 'Pas de sections enregistrées pour cette saison.' : undefined}>
          <select value={sectionEff} onChange={e => setSection(e.target.value)}
            disabled={sectionDisabled}
            className={selectCls} style={selectStyle}>
            <option value={TOUTES}>Toutes</option>
            {sections.liste.map(s => <option key={s} value={s}>{s}</option>)}
            {sections.sansSection && <option value={SANS_SECTION}>Sans section</option>}
          </select>
        </Filtre>
      </div>
    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

const selectCls =
  'w-full px-3 py-2 text-[13px] rounded-lg outline-none disabled:opacity-40 disabled:cursor-not-allowed'
const selectStyle = {
  border: '0.5px solid var(--csn-border-strong)',
  background: 'var(--csn-cream)',
  color: 'var(--csn-navy)',
}

function Filtre({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div title={hint}>
      <label className="text-[12px] text-slate-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function Vide({ texte = 'Aucun adhérent pour cette sélection.' }: { texte?: string }) {
  return (
    <div className="h-[520px] flex items-center justify-center text-[13px] text-slate-400 text-center px-6">
      {texte}
    </div>
  )
}

interface Part { sexe: Sexe; name: string; value: number }

function Camembert({ parts, total, tot }: { parts: Part[]; total: number; tot: Record<Sexe, number> }) {
  if (total === 0) return <Vide />

  return (
    <div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={parts}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="84%"
              startAngle={90}
              endAngle={-270}
              stroke="#ffffff"
              strokeWidth={2}
              labelLine={false}
              label={(p: { value: number; percent: number }) =>
                `${p.value} (${Math.round(p.percent * 100)} %)`}
              style={{ fontSize: 17, fontWeight: 500 }}
            >
              {parts.map(p => <Cell key={p.sexe} fill={COULEUR[p.sexe]} />)}
              <Label
                position="center"
                content={({ viewBox }) => {
                  const vb = viewBox as { cx?: number; cy?: number }
                  if (vb?.cx == null || vb?.cy == null) return null
                  return (
                    <g>
                      <text x={vb.cx} y={vb.cy - 2} textAnchor="middle"
                        style={{ fontSize: 48, fontWeight: 600, fill: '#1a3a5c' }}>
                        {total}
                      </text>
                      <text x={vb.cx} y={vb.cy + 28} textAnchor="middle"
                        style={{ fontSize: 16, fill: '#64748b' }}>
                        adhérents
                      </text>
                    </g>
                  )
                }}
              />
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${v} (${pct(v, total)})`, n]} />
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 16 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Chiffres bruts sous le graphe — lisibles même sans survol */}
      <div className="flex justify-center gap-10 mt-2 text-[15px] text-slate-600">
        <span><strong>{tot.F}</strong> femmes · {pct(tot.F, total)}</span>
        <span><strong>{tot.H}</strong> hommes · {pct(tot.H, total)}</span>
        {tot.NR > 0 && <span><strong>{tot.NR}</strong> non renseigné(s)</span>}
      </div>
    </div>
  )
}

interface LigneEvo { label: string; F: number; H: number; NR: number }

function Histogramme({ rows, avecNR, exclues }: { rows: LigneEvo[]; avecNR: boolean; exclues: string[] }) {
  if (rows.length === 0 || rows.every(r => r.F + r.H + r.NR === 0)) return <Vide />

  const series: Sexe[] = avecNR ? ['F', 'H', 'NR'] : ['F', 'H']

  return (
    <div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
            barGap={2} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 15, fill: '#475569' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <Tooltip
              cursor={{ fill: 'rgba(46,109,164,0.06)' }}
              formatter={(_v: number, n: string, item: { payload?: LigneEvo }) => {
                const r = item.payload
                const sexe = (Object.keys(SEXE_LABEL) as Sexe[]).find(x => SEXE_LABEL[x] === n)
                const brut = r && sexe ? r[sexe] : 0
                const total = r ? r.F + r.H + r.NR : 0
                return [`${brut} (${pct(brut, total)})`, n]
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 16 }} />
            {series.map(s => (
              <Bar key={s} dataKey={s} name={SEXE_LABEL[s]} fill={COULEUR[s]} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={s} position="top" style={{ fontSize: 14, fill: '#475569' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {exclues.length > 0 && (
        <p className="mt-2 text-[12px] text-slate-400 text-center">
          Saison(s) sans données de section, non affichée(s) avec ce filtre : {exclues.join(', ')}.
        </p>
      )}
    </div>
  )
}

// ── Âges ─────────────────────────────────────────────────────────────────────

interface LigneAge { tranche: TrancheId; label: string; value: number }

function AgeSaison({ rows, total, nr, pivot }: {
  rows: LigneAge[]; total: number; nr: number; pivot: string
}) {
  if (total === 0) return <Vide />

  return (
    <div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}
            barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
              interval={0} tick={{ fontSize: 14, fill: '#475569' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <Tooltip
              cursor={{ fill: 'rgba(46,109,164,0.06)' }}
              formatter={(_v: number, _n: string, item: { payload?: LigneAge }) =>
                [nbPct(item.payload?.value ?? 0, total), 'Adhérents']}
            />
            <Bar dataKey={(r: LigneAge) => hauteur(r.value)} name="Adhérents" radius={[4, 4, 0, 0]}>
              {rows.map(r => {
                const c = r.tranche === 'NR' ? COULEUR_AGE_NR : COULEUR_AGE
                return <Cell key={r.tranche} {...(masque(r.value) ? styleMasque(c) : { fill: c })} />
              })}
              <LabelList dataKey="value" position="top"
                content={(p) => {
                  const { x, y, width, value } = p as { x?: number; y?: number; width?: number; value?: number }
                  if (x == null || y == null || width == null || !value) return null
                  return (
                    <text x={x + width / 2} y={y - 8} textAnchor="middle"
                      style={{ fontSize: 14, fill: '#475569' }}>
                      {masque(value) ? `< ${SEUIL}` : `${value} · ${pct(value, total)}`}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[12px] text-slate-400 text-center">
        {total} adhérents · âge calculé au {pivot} (début de saison)
        {nr > 0 && <> · {nb(nr)} sans date de naissance exploitable</>}
        {rows.some(r => masque(r.value)) && <><br /><NoteSeuil /></>}
      </p>
    </div>
  )
}

function AgeEvolution({ rows, series, totParSaison, exclues }: {
  rows: Record<string, string | number>[]
  series: { id: string; label: string }[]
  totParSaison: Record<string, number>
  exclues: string[]
}) {
  if (series.length === 0 || Object.values(totParSaison).every(n => !n)) return <Vide />

  const couleurs = couleursSaisons(series.length)

  return (
    <div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
            barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
              interval={0} tick={{ fontSize: 14, fill: '#475569' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <Tooltip
              cursor={{ fill: 'rgba(46,109,164,0.06)' }}
              formatter={(_v: number, n: string, item: { payload?: Record<string, string | number> }) => {
                const s = series.find(x => x.label === n)
                const brut = s ? Number(item.payload?.[s.id] ?? 0) : 0
                const tot = s ? totParSaison[s.id] ?? 0 : 0
                return [nbPct(brut, tot), n]
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 16 }} />
            {series.map((s, i) => (
              <Bar key={s.id} dataKey={(r: Record<string, string | number>) => hauteur(Number(r[s.id] ?? 0))}
                name={s.label} fill={couleurs[i]} radius={[4, 4, 0, 0]}>
                {rows.map(r => (
                  <Cell key={String(r.tranche)}
                    {...(masque(Number(r[s.id] ?? 0)) ? styleMasque(couleurs[i]) : { fill: couleurs[i] })} />
                ))}
                <LabelList dataKey={s.id} position="top" formatter={(v: number) => (v ? nb(v) : '')}
                  style={{ fontSize: 13, fill: '#475569' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[12px] text-slate-400 text-center">
        Âge calculé au début de chaque saison.
        {exclues.length > 0 && <> Saison(s) sans données de section, non affichée(s) avec ce filtre : {exclues.join(', ')}.</>}
        {rows.some(r => series.some(s => masque(Number(r[s.id] ?? 0)))) && <> <NoteSeuil /></>}
      </p>
    </div>
  )
}

// ── Réinscription ────────────────────────────────────────────────────────────

const TYPES_REINSC: TypeReinscription[] = ['REINSCRIT', 'NOUVEAU', 'PARTI']

function totauxReinsc(r: StatReinscription, section: string): Record<TypeReinscription, number> {
  const t: Record<TypeReinscription, number> = { REINSCRIT: 0, NOUVEAU: 0, PARTI: 0 }
  for (const l of r.lignes) {
    const ok = section === TOUTES ? true
      : section === SANS_SECTION ? l.section === null
      : l.section === section
    if (ok) t[l.type] += l.count
  }
  return t
}

/** Taux = réinscrits / effectif de la saison précédente. */
function taux(t: Record<TypeReinscription, number>): number | null {
  const base = t.REINSCRIT + t.PARTI
  return base ? Math.round((t.REINSCRIT / base) * 100) : null
}

function Tuile({ titre, valeur, detail, couleur, grande }: {
  titre: string; valeur: string; detail?: string; couleur?: string; grande?: boolean
}) {
  return (
    <div className="rounded-xl px-4 py-3 flex flex-col gap-1"
      style={{ background: grande ? 'var(--csn-light)' : 'var(--csn-cream)', border: '0.5px solid var(--csn-border)' }}>
      <div className="text-[12px] text-slate-500 flex items-center gap-1.5">
        {couleur && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: couleur }} />}
        {titre}
      </div>
      <div className={grande ? 'text-[40px] leading-none font-semibold' : 'text-[28px] leading-none font-semibold'}
        style={{ color: 'var(--csn-navy)' }}>
        {valeur}
      </div>
      {detail && <div className="text-[12px] text-slate-500">{detail}</div>}
    </div>
  )
}

// Étiquette d'axe sur deux lignes : saison + effectif total
function TickSaison(props: { x?: number; y?: number; payload?: { value?: string }; totaux: Record<string, number> }) {
  const { x = 0, y = 0, payload, totaux } = props
  const label = payload?.value ?? ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={18} textAnchor="middle" style={{ fontSize: 15, fill: '#1a3a5c', fontWeight: 500 }}>{label}</text>
      <text dy={38} textAnchor="middle" style={{ fontSize: 13, fill: '#64748b' }}>
        {totaux[label] ?? 0} adhérents
      </text>
    </g>
  )
}

function ReinscriptionSaison({ r, section, labelP, labelN, provisoire }: {
  r: StatReinscription; section: string; labelP: string; labelN: string; provisoire: boolean
}) {
  const t = totauxReinsc(r, section)
  const tx = taux(t)
  const effP = t.REINSCRIT + t.PARTI
  const effN = t.REINSCRIT + t.NOUVEAU
  if (effP + effN === 0) return <Vide />

  // Deux colonnes empilées : P = réinscrits + non réinscrits ; N = réinscrits + nouveaux.
  // Le bloc bleu « réinscrits » est le même des deux côtés : c'est le pont entre les saisons.
  // undefined (et pas 0) pour la catégorie absente : l'infobulle l'ignore.
  const rows = [
    { label: labelP, REINSCRIT: t.REINSCRIT, PARTI: t.PARTI, NOUVEAU: undefined },
    { label: labelN, REINSCRIT: t.REINSCRIT, PARTI: undefined, NOUVEAU: t.NOUVEAU },
  ]
  const totaux: Record<string, number> = { [labelP]: effP, [labelN]: effN }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <Tuile grande titre="Taux de réinscription" valeur={tx === null ? '—' : `${tx} %`}
          detail={`${t.REINSCRIT} sur ${effP} adhérents ${labelP}`} />
        <Tuile titre="Réinscrits" valeur={String(t.REINSCRIT)} couleur={COULEUR_REINSC.REINSCRIT}
          detail={`présents en ${labelP} et ${labelN}`} />
        <Tuile titre="Nouveaux" valeur={String(t.NOUVEAU)} couleur={COULEUR_REINSC.NOUVEAU}
          detail={effN ? `${pct(t.NOUVEAU, effN)} de l'effectif ${labelN}` : undefined} />
        <Tuile titre={provisoire ? 'Pas encore réinscrits' : 'Non réinscrits'} valeur={String(t.PARTI)}
          couleur={COULEUR_REINSC.PARTI}
          detail={effP ? `${pct(t.PARTI, effP)} de l'effectif ${labelP}` : undefined} />
      </div>

      <div className="h-[420px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="horizontal" margin={{ top: 10, right: 16, left: 0, bottom: 30 }}
            barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={0}
              tick={(p: object) => <TickSaison {...p} totaux={totaux} />} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <Tooltip
              cursor={{ fill: 'rgba(46,109,164,0.06)' }}
              formatter={(v: number, n: string, item: { payload?: { label?: string } }) => {
                const tot = totaux[item.payload?.label ?? ''] ?? 0
                return [`${v} (${pct(v, tot)})`, n]
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 16, paddingTop: 24 }} />
            {(['REINSCRIT', 'PARTI', 'NOUVEAU'] as TypeReinscription[]).map((ty, i, arr) => (
              <Bar key={ty} dataKey={ty} name={provisoire && ty === 'PARTI' ? 'Pas encore réinscrits' : LABEL_REINSC[ty]}
                stackId="a" fill={COULEUR_REINSC[ty]} stroke="#ffffff" strokeWidth={2}
                radius={i === arr.length - 1 || ty !== 'REINSCRIT' ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                <LabelList dataKey={ty} position="center"
                  formatter={(v: number) => (v ? String(v) : '')}
                  style={{ fontSize: 16, fontWeight: 600, fill: ty === 'REINSCRIT' ? '#ffffff' : '#1a2e3f' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[12px] text-slate-400 text-center">
        {provisoire
          ? <>Chiffres provisoires au {r.dateDonnees} : les réinscriptions {labelN} se poursuivent. </>
          : <>Données au {r.dateDonnees}. </>}
        Taux = réinscrits ÷ effectif {labelP}.
        {r.parNom > 0 && <> {r.parNom} réinscrit(s) rapproché(s) par nom, faute de numéro de licence commun.</>}
      </p>
    </div>
  )
}

function ReinscriptionEvolution({ reinscriptions, section, labelSaison }: {
  reinscriptions: StatReinscription[]; section: string; labelSaison: (id: string) => string
}) {
  if (reinscriptions.length === 0) {
    return <Vide texte="Il faut au moins deux saisons en base pour calculer une réinscription." />
  }

  const rows = reinscriptions.map(r => {
    const t = totauxReinsc(r, section)
    const tx = taux(t)
    return {
      label: `${labelSaison(r.saisonId)}${tx === null ? '' : ` · ${tx} %`}`,
      ...t,
      effP: t.REINSCRIT + t.PARTI,
      effN: t.REINSCRIT + t.NOUVEAU,
    }
  })

  return (
    <div>
      <div className="h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
            barGap={2} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 15, fill: '#475569' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <Tooltip cursor={{ fill: 'rgba(46,109,164,0.06)' }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 16 }} />
            {TYPES_REINSC.map(ty => (
              <Bar key={ty} dataKey={ty} name={LABEL_REINSC[ty]} fill={COULEUR_REINSC[ty]} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={ty} position="top" style={{ fontSize: 14, fill: '#475569' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[12px] text-slate-400 text-center">
        Chaque saison est comparée à la précédente ; le pourcentage est le taux de réinscription.
        La saison en cours est provisoire.
      </p>
    </div>
  )
}

// ── Anciens / nouveaux par section ───────────────────────────────────────────
// Répond à deux questions avec des données RÉELLES (section de la saison N,
// connue pour les réinscrits comme pour les nouveaux) :
//   - quelle section amène des nouveaux ?   → nombre de nouveaux par section
//   - quelle section a une base solide ?    → part d'anciens dans la section
// La perte par section (non-réinscrits) n'est PAS calculable tant que la
// saison précédente n'a pas de sections : volontairement absente.

// En dessous de cet effectif, une section n'est pas citée dans les constats
// « base la plus solide / renouvellement le plus fort » : 3 anciens sur 3 =
// 100 %, ce qui ne veut rien dire.
const EFFECTIF_MIN_CONSTAT = 10
const SANS_SECTION_LABEL = 'Sans section'

interface LigneCompo {
  section: string
  REINSCRIT: number
  NOUVEAU: number
  total: number
  anciens: number   // % d'anciens (réinscrits) dans la section
}

function CompositionSections({ r, labelP, labelN, provisoire }: {
  r: StatReinscription; labelP: string; labelN: string; provisoire: boolean
}) {
  const parSection = new Map<string, LigneCompo>()
  for (const l of r.lignes) {
    if (l.type === 'PARTI') continue
    const nom = l.section ?? SANS_SECTION_LABEL
    const row = parSection.get(nom) ?? { section: nom, REINSCRIT: 0, NOUVEAU: 0, total: 0, anciens: 0 }
    row[l.type] += l.count
    row.total += l.count
    parSection.set(nom, row)
  }
  const rows = Array.from(parSection.values())
    .map(x => ({ ...x, anciens: x.total ? Math.round((x.REINSCRIT / x.total) * 100) : 0 }))
    .sort((a, b) =>
      (a.section === SANS_SECTION_LABEL ? 1 : 0) - (b.section === SANS_SECTION_LABEL ? 1 : 0)
      || b.total - a.total)

  if (rows.length === 0) return <Vide />

  // ── Constats automatiques (sections nommées uniquement) ───────────────────
  const nommees   = rows.filter(x => x.section !== SANS_SECTION_LABEL)
  const nbNouveaux = rows.reduce((n, x) => n + x.NOUVEAU, 0)
  const recruteur = [...nommees].sort((a, b) => b.NOUVEAU - a.NOUVEAU)[0]
  const fiables   = nommees.filter(x => x.total >= EFFECTIF_MIN_CONSTAT)
  const solide    = [...fiables].sort((a, b) => b.anciens - a.anciens)[0]
  const renouvele = [...fiables].sort((a, b) => a.anciens - b.anciens)[0]

  const hauteur = Math.max(300, rows.length * 64 + 70)

  return (
    <div>
      <div style={{ height: hauteur }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 150, left: 8, bottom: 0 }}
            barCategoryGap="26%">
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}
              tick={{ fontSize: 13, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="section" width={210} tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 15, fill: '#1a3a5c' }} />
            <Tooltip
              cursor={{ fill: 'rgba(46,109,164,0.06)' }}
              formatter={(v: number, n: string, item: { payload?: LigneCompo }) =>
                [`${v} (${pct(v, item.payload?.total ?? 0)})`, n]}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 16 }} />
            <Bar dataKey="REINSCRIT" name={`Anciens (déjà en ${labelP})`} stackId="a"
              fill={COULEUR_REINSC.REINSCRIT} stroke="#ffffff" strokeWidth={2}>
              <LabelList dataKey="REINSCRIT" position="center"
                formatter={(v: number) => (v ? String(v) : '')}
                style={{ fontSize: 15, fontWeight: 600, fill: '#ffffff' }} />
            </Bar>
            <Bar dataKey="NOUVEAU" name="Nouveaux" stackId="a"
              fill={COULEUR_REINSC.NOUVEAU} stroke="#ffffff" strokeWidth={2} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="NOUVEAU" position="center"
                formatter={(v: number) => (v ? String(v) : '')}
                style={{ fontSize: 15, fontWeight: 600, fill: '#1a2e3f' }} />
              {/* À droite de chaque barre : effectif total et part d'anciens */}
              <LabelList dataKey="total" position="right"
                content={(p) => {
                  const { x, y, width, height, index } = p as {
                    x?: number; y?: number; width?: number; height?: number; index?: number }
                  const row = index != null ? rows[index] : undefined
                  if (x == null || y == null || width == null || height == null || !row) return null
                  return (
                    <text x={x + width + 10} y={y + height / 2} dominantBaseline="middle"
                      style={{ fontSize: 14, fill: '#475569' }}>
                      {row.total} · <tspan style={{ fontWeight: 600, fill: '#1a3a5c' }}>{row.anciens} %</tspan> d&apos;anciens
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Constats — lisibles par la salle sans décoder le graphe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {recruteur && recruteur.NOUVEAU > 0 && (
          <Tuile titre="Section qui recrute le plus" valeur={recruteur.section}
            couleur={COULEUR_REINSC.NOUVEAU}
            detail={`${recruteur.NOUVEAU} nouveaux, soit ${pct(recruteur.NOUVEAU, nbNouveaux)} des nouveaux du club`} />
        )}
        {solide && (
          <Tuile titre="Base la plus solide" valeur={solide.section}
            couleur={COULEUR_REINSC.REINSCRIT}
            detail={`${solide.anciens} % d'anciens (${solide.REINSCRIT} sur ${solide.total})`} />
        )}
        {renouvele && renouvele !== solide && (
          <Tuile titre="Renouvellement le plus fort" valeur={renouvele.section}
            couleur={COULEUR_REINSC.NOUVEAU}
            detail={`${100 - renouvele.anciens} % de nouveaux (${renouvele.NOUVEAU} sur ${renouvele.total})`} />
        )}
      </div>

      <p className="mt-3 text-[12px] text-slate-400 text-center">
        Anciens = déjà adhérents en {labelP} ; section = celle de {labelN}.
        {' '}Constats calculés sur les sections d&apos;au moins {EFFECTIF_MIN_CONSTAT} adhérents.
        {' '}Les départs par section ne sont pas calculables : {labelP} n&apos;a pas de sections.
        {provisoire && <> Chiffres provisoires au {r.dateDonnees}, inscriptions en cours.</>}
        {r.parNom > 0 && <> {r.parNom} ancien(s) rapproché(s) par nom.</>}
      </p>
    </div>
  )
}
