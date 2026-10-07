'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getAdherentsEtiquettes, getSectionsDisponibles, AdherentEtiquette, AdherentFilters } from '@/app/actions/adherents'
import { PrintSelectionButton } from '@/components/PrintSelectionButton'
import { StatutBadge } from '@/components/StatutBadge'
import { STATUTS, STATUT_LABEL, Statut, peutAvoirEtiquette } from '@/lib/statut'

interface Props { saisonId: string; saisonLabel: string }

function caciColor(dateStr: string | null): string {
  if (!dateStr) return '#dc2626'
  try {
    const [d, m, y] = dateStr.split('/')
    const diff = Math.floor((new Date(+y, +m - 1, +d).getTime() - Date.now()) / 86400000)
    if (diff < 0)  return '#dc2626'
    if (diff < 90) return '#d97706'
    return '#16a34a'
  } catch { return '#94a3b8' }
}

function caciLabel(dateStr: string | null, jours: number | null): string {
  if (!dateStr) return 'Non renseigné'
  if (jours === null) return dateStr
  if (jours < 0) return `${dateStr} (expiré)`
  if (jours < 90) return `${dateStr} (${jours}j)`
  return dateStr
}

function joursRestants(dateStr: string | null): number | null {
  if (!dateStr) return null
  try {
    const [d, m, y] = dateStr.split('/')
    return Math.floor((new Date(+y, +m - 1, +d).getTime() - Date.now()) / 86400000)
  } catch { return null }
}

export default function AdherentsList({ saisonId, saisonLabel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adherents, setAdherents]   = useState<AdherentEtiquette[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [filters, setFilters]       = useState<AdherentFilters>({ search: '', imprime: '', statut: '' })
  const [sectionsDispo, setSectionsDispo] = useState<string[]>([])

  const load = useCallback((f: AdherentFilters, p: number) => {
    startTransition(async () => {
      const res = await getAdherentsEtiquettes(saisonId, { ...f, page: p, perPage: 25 })
      setAdherents(res.adherents)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(res.page)
      setSelected(new Set())
    })
  }, [saisonId])

  useEffect(() => {
    load(filters, 1)
    getSectionsDisponibles(saisonId).then(setSectionsDispo)
  }, []) // eslint-disable-line

  function applyFilters(f: AdherentFilters) { setFilters(f); load(f, 1) }

  // Les passagers n'ont pas d'étiquette (pas d'accès aux entraînements)
  const imprimables = adherents.filter(a => peutAvoirEtiquette(a.statut))

  function toggleOne(id: string) {
    const a = adherents.find(x => x.id === id)
    if (a && !peutAvoirEtiquette(a.statut)) return
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    setSelected(selected.size === imprimables.length
      ? new Set()
      : new Set(imprimables.map(a => a.id))
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Filtres + actions */}
      <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Rechercher nom, prénom, licence…"
            value={filters.search}
            onChange={e => applyFilters({ ...filters, search: e.target.value })}
            className="flex-1 min-w-[200px] px-3 py-2 text-[13px] rounded-lg outline-none"
            style={{
              border: '0.5px solid var(--csn-border-strong)',
              background: 'var(--csn-cream)',
              color: 'var(--csn-navy)',
            }}
          />
          <select
            value={filters.imprime}
            onChange={e => applyFilters({ ...filters, imprime: e.target.value as '' | 'oui' | 'non' })}
            className="px-3 py-2 text-[12px] rounded-lg outline-none"
            style={{
              border: '0.5px solid var(--csn-border-strong)',
              background: 'var(--csn-cream)',
              color: 'var(--csn-navy)',
            }}
          >
            <option value="">Tous</option>
            <option value="non">Non imprimés</option>
            <option value="oui">Déjà imprimés</option>
          </select>

          {sectionsDispo.length > 0 && (
            <select
              value={filters.section ?? ''}
              onChange={e => applyFilters({ ...filters, section: e.target.value })}
              className="px-3 py-2 text-[12px] rounded-lg outline-none"
              style={{
                border: '0.5px solid var(--csn-border-strong)',
                background: 'var(--csn-cream)',
                color: 'var(--csn-navy)',
              }}
            >
              <option value="">Toutes sections</option>
              {sectionsDispo.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          <select
            value={filters.statut ?? ''}
            onChange={e => applyFilters({ ...filters, statut: e.target.value as Statut | '' })}
            className="px-3 py-2 text-[12px] rounded-lg outline-none"
            style={{
              border: '0.5px solid var(--csn-border-strong)',
              background: 'var(--csn-cream)',
              color: 'var(--csn-navy)',
            }}
          >
            <option value="">Tous statuts</option>
            {STATUTS.map(s => (
              <option key={s} value={s}>{STATUT_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Barre actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[12px] text-slate-400">
            {isPending ? 'Chargement…' : `${total} adhérent${total > 1 ? 's' : ''}`}
            {selected.size > 0 && (
              <span className="ml-2 font-medium" style={{ color: 'var(--csn-navy)' }}>
                — {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
            )}
          </span>

          <div className="flex gap-2 items-center">
            {/* Sélection rapide non imprimés */}
            <button
              onClick={() => setSelected(new Set(imprimables.filter(a => !a.imprime).map(a => a.id)))}
              className="text-[11px] px-2.5 py-1 rounded border hover:bg-slate-50 transition-colors"
              style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
            >
              Sélect. non imprimés
            </button>

            {/* Bouton impression — branché sur PrintSelectionButton */}
            {selected.size > 0 && (
              <PrintSelectionButton
                selectedIds={[...selected]}
                onDone={() => {
                  setSelected(new Set())
                  router.refresh()
                  // Recharge la liste pour mettre à jour les indicateurs ✓
                  load(filters, page)
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl overflow-hidden"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                borderBottom: '0.5px solid var(--csn-border-strong)',
                background: 'var(--csn-cream)',
              }}>
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.size === imprimables.length && imprimables.length > 0}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="w-8 px-2 py-2.5 text-[10px] text-slate-400 font-medium text-center">
                  Imp.
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium">Nom</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium">Prénom</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden md:table-cell">
                  Licence
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden md:table-cell">
                  Section
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden lg:table-cell">
                  Expir. licence
                </th>
                <th className="w-16 px-2 py-2.5 text-center text-[10px] text-slate-400 font-medium hidden lg:table-cell">
                  FFESSM
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium">CACI</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {adherents.length === 0 && !isPending && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[13px] text-slate-400">
                    Aucun adhérent trouvé
                  </td>
                </tr>
              )}
              {adherents.map((a, i) => {
                const jours = joursRestants(a.caci)
                const isSelected = selected.has(a.id)
                const imprimable = peutAvoirEtiquette(a.statut)
                return (
                  <tr
                    key={a.id}
                    onClick={() => toggleOne(a.id)}
                    className={imprimable ? 'cursor-pointer transition-colors hover:bg-slate-50' : 'cursor-default'}
                    style={{
                      borderBottom: i < adherents.length - 1
                        ? '0.5px solid var(--csn-border)'
                        : undefined,
                      background: isSelected ? 'var(--csn-cream)' : undefined,
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(a.id)}
                        disabled={!imprimable}
                        title={imprimable ? undefined : "Passager — pas d'étiquette"}
                        className={imprimable ? 'cursor-pointer' : 'cursor-not-allowed'}
                      />
                    </td>

                    {/* Indicateur impression */}
                    <td className="px-2 py-2.5 text-center">
                      <span
                        className="text-[14px]"
                        title={a.imprime ? 'Déjà imprimé' : 'Non imprimé'}
                      >
                        {a.imprime ? '✓' : '○'}
                      </span>
                    </td>

                    {/* Nom */}
                    <td className="px-3 py-2.5 text-[13px] font-medium"
                      style={{ color: 'var(--csn-navy)' }}>
                      {a.nom}
                      <span className="ml-1.5"><StatutBadge statut={a.statut} /></span>
                    </td>

                    {/* Prénom */}
                    <td className="px-3 py-2.5 text-[13px]" style={{ color: '#1a2e3f' }}>
                      {a.prenom}
                    </td>

                    {/* Licence */}
                    <td className="px-3 py-2.5 text-[12px] text-slate-400 hidden md:table-cell">
                      {a.licence ?? '—'}
                    </td>

                    {/* Section */}
                    <td className="px-3 py-2.5 text-[12px] text-slate-400 hidden md:table-cell">
                      {a.section ?? '—'}
                    </td>

                    {/* Date expiration licence */}
                    <td className="px-3 py-2.5 text-[12px] text-slate-400 hidden lg:table-cell">
                      {a.dateExpiration ?? '—'}
                    </td>

                    {/* FFESSM — colonne calculée à partir du fichier FFESSM importé (cf. écran Suivi) */}
                    <td className="px-2 py-2.5 text-center hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={a.ffessmOk}
                        readOnly
                        disabled
                        title={
                          a.statut === 'EXTERNE'
                            ? 'Adhérent externe — licence prise dans un autre club'
                            : a.ffessmForce && a.ffessmOk
                              ? 'Validation FFESSM forcée manuellement'
                            : a.ffessmOk
                              ? 'Licence retrouvée dans le fichier FFESSM'
                              : 'Absente du fichier FFESSM'
                        }
                        className="cursor-default"
                      />
                    </td>

                    {/* CACI */}
                    <td className="px-3 py-2.5 text-[12px] font-medium"
                      style={{ color: caciColor(a.caci) }}>
                      {caciLabel(a.caci, jours)}
                    </td>

                    {/* Lien fiche */}
                    <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                      <Link
                        href={`/adherents/${a.id}`}
                        className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50 transition-colors"
                        style={{ borderColor: 'var(--csn-border)', color: 'var(--csn-blue)' }}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => load(filters, page - 1)}
            disabled={page <= 1 || isPending}
            className="text-[12px] px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-slate-50 transition-colors"
            style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
          >
            ← Précédent
          </button>
          <span className="text-[12px] text-slate-400">Page {page} / {totalPages}</span>
          <button
            onClick={() => load(filters, page + 1)}
            disabled={page >= totalPages || isPending}
            className="text-[12px] px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-slate-50 transition-colors"
            style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
