'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { getAdherentsAttestations, AdherentAttestation, AdherentFilters } from '@/app/actions/adherents'

interface Props { saisonId: string; saisonLabel: string }

export default function AttestationsList({ saisonId, saisonLabel }: Props) {
  const [isPending, startTransition] = useTransition()
  const [adherents, setAdherents]   = useState<AdherentAttestation[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [filters, setFilters]       = useState<AdherentFilters>({ search: '', attestation: '' })

  const load = useCallback((f: AdherentFilters, p: number) => {
    startTransition(async () => {
      const res = await getAdherentsAttestations(saisonId, { ...f, page: p, perPage: 25 })
      setAdherents(res.adherents)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPage(res.page)
      setSelected(new Set())
    })
  }, [saisonId])

  useEffect(() => { load(filters, 1) }, []) // eslint-disable-line

  function applyFilters(f: AdherentFilters) { setFilters(f); load(f, 1) }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(selected.size === adherents.length ? new Set() : new Set(adherents.map(a => a.id)))
  }

  const civLabel = (c: string | null) => {
    if (!c) return ''
    if (c.toLowerCase().includes('madame')) return 'Mme'
    if (c.toLowerCase().includes('mademoiselle') || c.toLowerCase().includes('melle')) return 'Melle'
    return 'M.'
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl p-4 flex flex-col gap-3"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>
        <div className="flex gap-3 flex-wrap">
          <input type="text" placeholder="Rechercher nom, prénom…"
            value={filters.search}
            onChange={e => applyFilters({ ...filters, search: e.target.value })}
            className="flex-1 min-w-[200px] px-3 py-2 text-[13px] rounded-lg outline-none"
            style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
          />
          <select value={filters.attestation}
            onChange={e => applyFilters({ ...filters, attestation: e.target.value as '' | 'oui' | 'non' })}
            className="px-3 py-2 text-[12px] rounded-lg outline-none"
            style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}>
            <option value="">Tous</option>
            <option value="non">Sans attestation</option>
            <option value="oui">Attestation envoyée</option>
          </select>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[12px] text-slate-400">
            {isPending ? 'Chargement…' : `${total} adhérent${total > 1 ? 's' : ''}`}
            {selected.size > 0 && (
              <span className="ml-2 font-medium" style={{ color: 'var(--csn-navy)' }}>
                — {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set(adherents.filter(a => !a.attestationEnvoyee && a.email).map(a => a.id)))}
              className="text-[11px] px-2.5 py-1 rounded border hover:bg-slate-50 transition-colors"
              style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>
              Sélect. sans attestation
            </button>
            {selected.size > 0 && (
              <button
                className="text-[11px] px-3 py-1 rounded border hover:bg-blue-50 transition-colors"
                style={{ borderColor: 'var(--csn-border-strong)', color: '#185fa5' }}
                onClick={() => alert(`Envoi attestation à ${selected.size} adhérent(s) — à venir Phase 4`)}>
                ✉ Envoyer ({selected.size})
              </button>
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
              <tr style={{ borderBottom: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)' }}>
                <th className="w-8 px-3 py-2.5">
                  <input type="checkbox"
                    checked={selected.size === adherents.length && adherents.length > 0}
                    onChange={toggleAll} className="cursor-pointer" />
                </th>
                <th className="w-8 px-2 py-2.5 text-[10px] text-slate-400 font-medium text-center">Att.</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium w-12">Civ.</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium">Nom</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium">Prénom</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden md:table-cell">Montant</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden lg:table-cell">Email</th>
                <th className="px-3 py-2.5 text-left text-[11px] text-slate-500 font-medium hidden lg:table-cell">Dernière attestation</th>
                <th className="w-8 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {adherents.length === 0 && !isPending && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-[13px] text-slate-400">Aucun adhérent trouvé</td></tr>
              )}
              {adherents.map((a, i) => (
                <tr key={a.id}
                  className="transition-colors hover:bg-slate-50 cursor-pointer"
                  style={{ borderBottom: i < adherents.length - 1 ? '0.5px solid var(--csn-border)' : 'none', background: selected.has(a.id) ? '#f0f7ff' : undefined }}
                  onClick={() => toggleOne(a.id)}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} className="cursor-pointer" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]"
                      style={{ background: a.attestationEnvoyee ? '#e6f1fb' : 'var(--csn-cream)', color: a.attestationEnvoyee ? '#185fa5' : '#94a3b8', border: `0.5px solid ${a.attestationEnvoyee ? '#93c5fd' : 'var(--csn-border)'}` }}>
                      {a.attestationEnvoyee ? '✓' : '○'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-400">{civLabel(a.civilite)}</td>
                  <td className="px-3 py-2.5 text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>{a.nom}</td>
                  <td className="px-3 py-2.5 text-[13px]" style={{ color: '#1a2e3f' }}>{a.prenom}</td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-500 hidden md:table-cell">{a.montant ?? '—'}</td>
                  <td className="px-3 py-2.5 text-[12px] hidden lg:table-cell">
                    {a.email ? (
                      <span style={{ color: 'var(--csn-blue)' }}>{a.email}</span>
                    ) : (
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: '#fff3cd', color: '#7a5a00' }}>⚠ Manquant</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-slate-400 hidden lg:table-cell">
                    {a.dateDerniereAttestation
                      ? new Date(a.dateDerniereAttestation).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                    <Link href={`/adherents/${a.id}`}
                      className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50 transition-colors"
                      style={{ borderColor: 'var(--csn-border)', color: 'var(--csn-blue)' }}>→</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => load(filters, page - 1)} disabled={page <= 1 || isPending}
            className="text-[12px] px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-slate-50"
            style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>← Précédent</button>
          <span className="text-[12px] text-slate-400">Page {page} / {totalPages}</span>
          <button onClick={() => load(filters, page + 1)} disabled={page >= totalPages || isPending}
            className="text-[12px] px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-slate-50"
            style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}>Suivant →</button>
        </div>
      )}
    </div>
  )
}
