'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border transition-colors hover:bg-slate-50"
      style={{
        borderColor: 'var(--csn-border-strong)',
        color: 'var(--csn-navy)',
      }}
      title="Page précédente"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Retour
    </button>
  )
}
