'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { importerBrevets, type ImportBrevetsResult } from '@/app/actions/brevets'

// ── Import d'un export « Liste des brevets » ─────────────────────────────────

// Déplacé depuis la page Statistiques (Diplomes.tsx) vers Gestion des diplômes.

export default function ImportBrevets() {
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
        router.refresh()                    // récapitulatif et suggestions à jour
      }
    } catch (err) {
      setResultat({ success: false, error: String(err) })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      <div className="text-[12px] text-slate-500">
        Importer une liste des brevets (export FFESSM, une saison par fichier).
        La saison est lue dans le fichier ; si elle est déjà importée, ses brevets importés sont remplacés.
        Les diplômes saisis à la main sont conservés, sauf ceux que l&apos;export contient déjà.
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
                {resultat.remplaces ? ` (remplacent les ${resultat.remplaces} précédents)` : ''}.
                {resultat.saisiesRemplacees
                  ? ` ${resultat.saisiesRemplacees} diplôme(s) saisi(s) à la main figuraient dans l'export : remplacés par la version FFESSM.`
                  : ''}</>
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
