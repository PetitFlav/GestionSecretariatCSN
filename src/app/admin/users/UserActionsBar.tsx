'use client'

import { useTransition, useState } from 'react'
import { approveUserAction, disableUserAction } from '@/app/actions/auth'

interface UserActionsBarProps {
  userId: string
  status: string
  currentRole: string
}

export default function UserActionsBar({ userId, status, currentRole }: UserActionsBarProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState(currentRole)
  const [feedback, setFeedback] = useState<string | null>(null)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveUserAction(userId, selectedRole as 'USER' | 'ADMIN' | 'SUPERUSER')
      if (result.error) setFeedback(result.error)
      if (result.success) setFeedback(result.success)
    })
  }

  function handleDisable() {
    if (!confirm('Désactiver ce compte ?')) return
    startTransition(async () => {
      const result = await disableUserAction(userId)
      if (result.error) setFeedback(result.error)
      if (result.success) setFeedback(result.success)
    })
  }

  if (feedback) {
    return (
      <span className="text-[11px] text-slate-500 italic max-w-[180px] text-right">
        {feedback}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {status === 'PENDING' && (
        <>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="text-[11px] px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--csn-border-strong)',
              background: 'var(--csn-cream)',
              color: 'var(--csn-navy)',
            }}
          >
            <option value="USER">user</option>
            <option value="ADMIN">admin</option>
            <option value="SUPERUSER">superuser</option>
          </select>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="text-[11px] px-3 py-1 rounded text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--csn-navy)' }}
          >
            {isPending ? '…' : 'Approuver'}
          </button>
          <button
            onClick={handleDisable}
            disabled={isPending}
            className="text-[11px] px-3 py-1 rounded border disabled:opacity-50 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            style={{
              borderColor: 'var(--csn-border-strong)',
              color: '#64748b',
            }}
          >
            Refuser
          </button>
        </>
      )}

      {status === 'ACTIVE' && (
        <button
          onClick={handleDisable}
          disabled={isPending}
          className="text-[11px] px-3 py-1 rounded border disabled:opacity-50 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          style={{
            borderColor: 'var(--csn-border-strong)',
            color: '#64748b',
          }}
        >
          {isPending ? '…' : 'Désactiver'}
        </button>
      )}

      {status === 'DISABLED' && (
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="text-[11px] px-3 py-1 rounded text-white disabled:opacity-50 transition-opacity"
          style={{ background: 'var(--csn-navy)' }}
        >
          {isPending ? '…' : 'Réactiver'}
        </button>
      )}
    </div>
  )
}
