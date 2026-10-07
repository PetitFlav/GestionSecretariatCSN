import { Statut, STATUT_LABEL, STATUT_BADGE } from '@/lib/statut'

// Badge de statut d'adhésion — rien pour LICENCIE (cas standard).
export function StatutBadge({ statut, size = 'sm' }: { statut: Statut; size?: 'sm' | 'md' }) {
  const c = STATUT_BADGE[statut]
  if (!c) return null
  return (
    <span
      className={size === 'md' ? 'text-[11px] px-2 py-0.5 rounded-full' : 'text-[10px] px-1.5 py-0.5 rounded-full'}
      style={{ background: c.bg, color: c.fg, border: `0.5px solid ${c.border}` }}
    >
      {STATUT_LABEL[statut].toLowerCase()}
    </span>
  )
}
