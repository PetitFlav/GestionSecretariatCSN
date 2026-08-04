'use client'

import { useState } from 'react'
import { extractionOms } from '@/app/actions/extractions'

interface Saison {
  id: string
  label: string
  isActive: boolean
}

interface Props {
  saisons: Saison[]
}

// Fichier .xls ancien format (BIFF) — MIME Excel classique.
const XLS_MIME = 'application/vnd.ms-excel'

export default function ExtractionsOmsClient({ saisons }: Props) {
  const active = saisons.find(s => s.isActive) ?? saisons[0]
  const [saisonId, setSaisonId] = useState(active?.id ?? '')
  const [isPending, setIsPending] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [communesNonReconnues, setCommunesNonReconnues] = useState<string[]>([])

  async function handleExport() {
    setIsPending(true)
    setMsg(null)
    setCommunesNonReconnues([])
    try {
      const res = await extractionOms(saisonId)
      if (!res.ok || !res.base64) {
        setMsg({ type: 'err', text: res.error ?? 'Échec de l\'extraction' })
        return
      }
      setCommunesNonReconnues(res.communesNonReconnues ?? [])
      // Téléchargement navigateur
      const a = document.createElement('a')
      a.href     = `data:${XLS_MIME};base64,${res.base64}`
      a.download = res.filename ?? 'Oms_Effectifs.xls'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setMsg({ type: 'ok', text: `${res.count} adhérent(s) exporté(s).` })
    } catch (e) {
      setMsg({ type: 'err', text: String(e) })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Consignes O.M.S */}
      <div className="rounded-xl p-4 text-[12px]"
        style={{ background: 'var(--csn-light)', border: '0.5px solid var(--csn-border-strong)', color: '#1a2e3f' }}>
        Le fichier généré suit le gabarit O.M.S (D coché = délégataire, Lo par défaut,
        Nl pour les non-licenciés). Deux vérifications restent manuelles avant l&apos;envoi :
        cocher la colonne <strong>Co</strong> pour les compétiteurs, et contrôler que la
        colonne <strong>Ville</strong> correspond exactement aux noms des communes de
        Nantes métropole.
      </div>

      {/* Résultat */}
      {msg && (
        <div className="rounded-xl p-4 text-[13px]"
          style={{
            background: msg.type === 'ok' ? '#eaf7f0' : '#fff3cd',
            border:     `0.5px solid ${msg.type === 'ok' ? '#7dd4a8' : '#e8c96a'}`,
            color:      msg.type === 'ok' ? '#1a6642' : '#7a5a00',
          }}>
          {msg.text}
        </div>
      )}

      {/* Communes non reconnues — à vérifier à la main */}
      {communesNonReconnues.length > 0 && (
        <div className="rounded-xl p-4 text-[12px]"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          <div className="font-medium mb-1">
            {communesNonReconnues.length} commune(s) hors liste Nantes métropole
          </div>
          <div className="mb-1.5">
            Ces villes ont été laissées telles quelles dans le fichier. Vérifie qu&apos;il s&apos;agit
            bien de résidents hors métropole (normal) et non de fautes de frappe à corriger.
          </div>
          <div>{communesNonReconnues.join(' · ')}</div>
        </div>
      )}

      {/* Carte principale */}
      <div className="bg-white rounded-xl p-5 flex flex-col gap-5"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>

        <div>
          <label className="text-[12px] text-slate-500 mb-1.5 block">
            Saison à extraire <span className="text-red-400">*</span>
          </label>
          <select
            value={saisonId}
            onChange={e => setSaisonId(e.target.value)}
            className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
            style={{
              border: '0.5px solid var(--csn-border-strong)',
              background: 'var(--csn-cream)',
              color: 'var(--csn-navy)',
            }}
          >
            {saisons.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}{s.isActive ? ' (active)' : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1.5">
            L&apos;extraction porte sur les membres actifs de la saison choisie
            (y compris les saisons passées).
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={isPending || !saisonId}
          className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: 'var(--csn-navy)' }}
        >
          {isPending ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="white" strokeWidth="2">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/>
                <path d="M21 12a9 9 0 00-9-9"/>
              </svg>
              Génération…
            </>
          ) : (
            'Générer l\'extraction O.M.S →'
          )}
        </button>
      </div>
    </div>
  )
}
