'use client'

import { useState, useTransition } from 'react'
import { creerSaison, activerSaison } from '@/app/actions/import'

interface Saison {
  id: string
  label: string
  isActive: boolean
  dateDebut: string
  dateFin: string
  dateExpireLicence: string
  createdAt: Date
}

export default function SaisonsClient({ saisons: initial }: { saisons: Saison[] }) {
  const [saisons, setSaisons] = useState(initial)
  const [showForm, setShowForm] = useState(initial.length === 0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    dateDebut: '',
    dateFin: '',
    dateExpireLicence: '',
  })

  // Auto-remplir le label depuis les dates
  function handleDateDebut(val: string) {
    setForm(f => {
      const debut = val ? new Date(val + '-01') : null
      const fin   = f.dateFin ? new Date(f.dateFin + '-01') : null
      const label = debut && fin
        ? `${debut.getFullYear()}-${fin.getFullYear()}`
        : f.label
      return { ...f, dateDebut: val, label }
    })
  }

  // Formater une date input AAAA-MM en JJ/MM/AAAA (premier ou dernier jour)
  function toFr(yyyyMM: string, lastDay = false): string {
    if (!yyyyMM) return ''
    const [y, m] = yyyyMM.split('-')
    if (lastDay) {
      const d = new Date(parseInt(y), parseInt(m), 0).getDate()
      return `${String(d).padStart(2,'0')}/${m}/${y}`
    }
    return `01/${m}/${y}`
  }

  function handleSubmit() {
    setError(null)
    const data = {
      label:            form.label,
      dateDebut:        toFr(form.dateDebut),
      dateFin:          toFr(form.dateFin, true),
      dateExpireLicence: form.dateExpireLicence
        ? `31/12/${form.dateExpireLicence}`
        : toFr(form.dateFin, true),
    }

    if (!data.label || !data.dateDebut || !data.dateFin) {
      setError('Tous les champs obligatoires doivent être renseignés')
      return
    }

    startTransition(async () => {
      const res = await creerSaison(data)
      if (res.success) {
        window.location.reload()
      } else {
        setError(res.error ?? 'Erreur lors de la création')
      }
    })
  }

  function handleActiver(id: string) {
    startTransition(async () => {
      await activerSaison(id)
      setSaisons(prev => prev.map(s => ({ ...s, isActive: s.id === id })))
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Liste des saisons */}
      {saisons.length > 0 && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: '0.5px solid var(--csn-border-strong)' }}
        >
          {saisons.map((s, i) => (
            <div key={s.id}
              className="flex items-center gap-4 px-4 py-3"
              style={{
                borderBottom: i < saisons.length - 1
                  ? '0.5px solid var(--csn-border)'
                  : 'none',
              }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>
                    {s.label}
                  </span>
                  {s.isActive && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: '#eaf7f0', color: '#1a6642' }}>
                      Active
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {s.dateDebut} → {s.dateFin} — licence jusqu&apos;au {s.dateExpireLicence}
                </div>
              </div>
              {!s.isActive && (
                <button
                  onClick={() => handleActiver(s.id)}
                  disabled={isPending}
                  className="text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-slate-50 disabled:opacity-50"
                  style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
                >
                  Activer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bouton créer */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-[13px] font-medium py-2.5 px-4 rounded-lg transition-colors hover:opacity-90 text-white"
          style={{ background: 'var(--csn-navy)' }}
        >
          <span>+</span> Créer une nouvelle saison
        </button>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div
          className="bg-white rounded-xl p-5 flex flex-col gap-4"
          style={{ border: '0.5px solid var(--csn-border-strong)' }}
        >
          <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Nouvelle saison
          </h2>

          {error && (
            <div className="rounded-lg px-3 py-2 text-[12px]"
              style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-slate-500 mb-1 block">
                Début de saison <span className="text-red-400">*</span>
              </label>
              <input type="month" value={form.dateDebut}
                onChange={e => handleDateDebut(e.target.value)}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
                placeholder="ex: 2025-09"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">ex: septembre 2025</p>
            </div>
            <div>
              <label className="text-[12px] text-slate-500 mb-1 block">
                Fin de saison <span className="text-red-400">*</span>
              </label>
              <input type="month" value={form.dateFin}
                onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">ex: juillet 2026</p>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">
              Année expiration licence FFESSM <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-slate-400">31/12/</span>
              <input type="number" value={form.dateExpireLicence}
                onChange={e => setForm(f => ({ ...f, dateExpireLicence: e.target.value }))}
                placeholder="2026"
                min="2024" max="2030"
                className="w-28 px-3 py-2 text-[13px] rounded-lg outline-none"
                style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              La licence FFESSM expire toujours au 31/12 de l&apos;année suivante
            </p>
          </div>

          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">Label saison</label>
            <input type="text" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="ex: 2025-2026"
              className="w-full px-3 py-2 text-[13px] rounded-lg outline-none"
              style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }}
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Auto-rempli depuis les dates</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--csn-navy)' }}
            >
              {isPending ? 'Création…' : 'Créer la saison →'}
            </button>
            {saisons.length > 0 && (
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg text-[13px] border transition-colors hover:bg-slate-50"
                style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
