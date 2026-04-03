'use client'

import { useState, useRef } from 'react'
import { importerFichiers, ImportResult } from '@/app/actions/import'

interface Saison {
  id: string
  label: string
  isActive: boolean
  dateDebut: string
  dateFin: string
  dateExpireLicence: string
}

interface ImportFormProps {
  saisons: Saison[]
}

interface FileInputProps {
  label: string
  name: string
  required?: boolean
  accept?: string
}

function FileInput({ label, name, required, accept }: FileInputProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] text-slate-500">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {!required && (
          <span className="text-[11px] text-slate-400">Facultatif</span>
        )}
      </div>
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-50"
        style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)' }}
        onClick={() => inputRef.current?.click()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={fileName ? 'var(--csn-navy)' : '#94a3b8'} strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span className="text-[13px] flex-1 truncate"
          style={{ color: fileName ? 'var(--csn-navy)' : '#94a3b8' }}>
          {fileName ?? 'Cliquez pour sélectionner…'}
        </span>
        {fileName && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFileName(null); if (inputRef.current) inputRef.current.value = '' }}
            className="text-slate-400 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept ?? '.xlsx,.xlsm,.xls'}
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  )
}

export default function ImportForm({ saisons }: ImportFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const saisonActive = saisons.find(s => s.isActive) ?? saisons[0]
  const [selectedSaisonId, setSelectedSaisonId] = useState(saisonActive?.id ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setResult(null)

    try {
      const formData = new FormData(e.currentTarget)
      const res = await importerFichiers(formData)
      setResult(res)
    } catch (err) {
      setResult({ success: false, error: String(err) })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Résultat import */}
      {result && (
        <div
          className="rounded-xl p-5"
          style={{
            background: result.success ? '#eaf7f0' : '#fff3cd',
            border: `0.5px solid ${result.success ? '#7dd4a8' : '#e8c96a'}`,
          }}
        >
          {result.success && result.stats ? (
            <>
              <div className="text-[13px] font-medium mb-3"
                style={{ color: '#1a6642' }}>
                Import terminé avec succès
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label: 'Créés',           val: result.stats.crees,         color: '#1a6642' },
                  { label: 'Mis à jour',       val: result.stats.misAJour,      color: 'var(--csn-navy)' },
                  { label: 'Ignorés',          val: result.stats.ignores,       color: '#7a5a00' },
                  { label: 'Désync FFESSM',    val: result.stats.desyncsFFESSM, color: '#c2410c' },
                ].map(({ label, val, color }) => (
                  <div key={label}
                    className="bg-white rounded-lg px-3 py-2"
                    style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <div className="text-[11px] text-slate-400">{label}</div>
                    <div className="text-[20px] font-medium" style={{ color }}>{val}</div>
                  </div>
                ))}
              </div>
              {result.stats.erreurs.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[12px] cursor-pointer text-slate-500">
                    {result.stats.erreurs.length} avertissement(s)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.stats.erreurs.map((e, i) => (
                      <li key={i} className="text-[11px] text-slate-500">• {e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="text-[13px]" style={{ color: '#7a5a00' }}>
              {result.error}
            </div>
          )}
        </div>
      )}

      {/* Formulaire */}
      <form ref={formRef} onSubmit={handleSubmit}
        className="bg-white rounded-xl p-5 flex flex-col gap-5"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}>

        {/* Sélection saison */}
        <div>
          <label className="text-[12px] text-slate-500 mb-1.5 block">
            Saison cible <span className="text-red-400">*</span>
          </label>
          <select
            name="saisonId"
            value={selectedSaisonId}
            onChange={e => setSelectedSaisonId(e.target.value)}
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
          {saisons.find(s => s.id === selectedSaisonId) && (
            <p className="text-[11px] text-slate-400 mt-1">
              {saisons.find(s => s.id === selectedSaisonId)?.dateDebut} →{' '}
              {saisons.find(s => s.id === selectedSaisonId)?.dateFin} —
              licence jusqu&apos;au {saisons.find(s => s.id === selectedSaisonId)?.dateExpireLicence}
            </p>
          )}
        </div>

        <div
          className="border-t pt-4"
          style={{ borderColor: 'var(--csn-border)' }}
        >
          <p className="text-[12px] text-slate-400 mb-4">
            Les fichiers <strong>Membres</strong> et <strong>Paiements</strong> sont obligatoires.
            Le fichier <strong>FFESSM</strong> est facultatif (vérification des licences).
          </p>

          <div className="flex flex-col gap-4">
            <FileInput
              label="Fichier Membres (export VPdive)"
              name="membres"
              required
            />
            <FileInput
              label="Fichier Paiements trésorerie"
              name="paiements"
              required
            />
            <FileInput
              label="Fichier FFESSM (validation licences)"
              name="ffessm"
              accept=".xlsm,.xlsx,.xls"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
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
              Import en cours…
            </>
          ) : (
            'Lancer l\'import →'
          )}
        </button>
      </form>
    </div>
  )
}
