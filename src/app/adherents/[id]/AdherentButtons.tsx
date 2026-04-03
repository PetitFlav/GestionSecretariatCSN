'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { togglePassager } from '@/app/actions/adherents'

export function BoutonEtiquette({ adherentId }: { adherentId: string }) {
  return (
    <button
      className="text-[12px] px-3 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
      style={{ background: 'var(--csn-navy)' }}
      onClick={() => alert('Impression étiquette — WebUSB à venir')}
    >
      🖨 Étiquette
    </button>
  )
}

export function BoutonAttestation({ adherentId }: { adherentId: string }) {
  return (
    <button
      className="text-[12px] px-3 py-2 rounded-lg border transition-colors hover:bg-slate-50"
      style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-blue)' }}
      onClick={() => alert('Envoi attestation — à venir Phase 4')}
    >
      ✉ Attestation
    </button>
  )
}

export function TogglePassager({
  adherentId,
  initialValue,
}: {
  adherentId: string
  initialValue: boolean
}) {
  const [passager, setPassager] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      await togglePassager(adherentId, checked)
      setPassager(checked)
      router.refresh()
    })
  }

  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={passager}
          onChange={e => handleChange(e.target.checked)}
          disabled={isPending}
          className="sr-only"
        />
        <div
          className="w-9 h-5 rounded-full transition-colors"
          style={{
            background: passager ? 'var(--csn-navy)' : '#e2e8f0',
            opacity: isPending ? 0.6 : 1,
          }}
        />
        <div
          className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: passager ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </div>
      <span className="text-[13px]" style={{ color: passager ? 'var(--csn-navy)' : '#64748b' }}>
        {passager ? 'Passager (licence dans un autre club)' : 'Membre standard'}
      </span>
    </label>
  )
}
