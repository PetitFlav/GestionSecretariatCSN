'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  Tooltip, Legend,
} from 'recharts'
import type { StatsData, StatLigne } from '@/app/actions/statistiques'
import { SEXE_LABEL, type Sexe } from '@/lib/sexe'
import { TRANCHE_LABEL, ORDRE_TRANCHES, type TrancheId } from '@/lib/ages'

// ── Réglages ─────────────────────────────────────────────────────────────────

// Catalogue des statistiques — ajouter une entrée ici + son rendu plus bas.
const STATS = [
  { id: 'sexe', label: 'Répartition femmes / hommes' },
  { id: 'age',  label: "Répartition par tranche d'âge" },
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
  const { saisons, lignes } = data
  const active = saisons.find(s => s.isActive) ?? saisons[saisons.length - 1]

  const [stat,     setStat]     = useState<StatId>('sexe')
  const [mode,     setMode]     = useState<Mode>('saison')
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
  const sectionDisabled = mode === 'saison'
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

  const nomStat = stat === 'sexe' ? 'Femmes / hommes' : "Tranches d'âge"
  const titre = mode === 'saison'
    ? `${nomStat} — ${saison.label} (${libelleSection})`
    : `Évolution ${nomStat.toLowerCase()} par saison (${libelleSection})`

  // Mention discrète des invités écartés (licence « INVITE »)
  const nbInvites = mode === 'saison'
    ? saison.invites
    : saisons.reduce((n, s) => n + s.invites, 0)
  const noteInvites = nbInvites > 0
    ? `${nbInvites} invité(s) hors CSN exclu(s) des chiffres${mode === 'evolution' ? ' (toutes saisons)' : ''}.`
    : null

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

        {noteInvites && (
          <p className="mt-3 text-[11px] text-slate-400 text-center">{noteInvites}</p>
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

        <Filtre label="Affichage">
          <select value={mode} onChange={e => setMode(e.target.value as Mode)}
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
          hint={sectionDisabled ? 'Pas de sections enregistrées pour cette saison.' : undefined}>
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

function Vide() {
  return (
    <div className="h-[520px] flex items-center justify-center text-[13px] text-slate-400">
      Aucun adhérent pour cette sélection.
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
