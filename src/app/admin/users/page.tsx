import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import UserActionsBar from './UserActionsBar'

export default async function AdminUsersPage() {
  const currentUser = await getSessionUser()

  if (
    !currentUser ||
    currentUser.status !== 'ACTIVE' ||
    (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERUSER')
  ) {
    redirect('/')
  }

  const users = await prisma.user.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const pending = users.filter((u) => u.status === 'PENDING')
  const active  = users.filter((u) => u.status === 'ACTIVE')
  const disabled = users.filter((u) => u.status === 'DISABLED')

  return (
    <AppLayout user={currentUser}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Gestion des utilisateurs
          </h1>
          {pending.length > 0 && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: '#fff3cd', color: '#7a5a00' }}
            >
              {pending.length} en attente
            </span>
          )}
        </div>

        {/* En attente */}
        {pending.length > 0 && (
          <Section title="En attente de validation">
            {pending.map((u) => (
              <UserRow key={u.id} user={u} currentUserId={currentUser.id} />
            ))}
          </Section>
        )}

        {/* Actifs */}
        <Section title="Comptes actifs">
          {active.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-3">Aucun compte actif.</p>
          ) : (
            active.map((u) => (
              <UserRow key={u.id} user={u} currentUserId={currentUser.id} />
            ))
          )}
        </Section>

        {/* Désactivés */}
        {disabled.length > 0 && (
          <Section title="Comptes désactivés">
            {disabled.map((u) => (
              <UserRow key={u.id} user={u} currentUserId={currentUser.id} />
            ))}
          </Section>
        )}
      </div>
    </AppLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-[12px] uppercase tracking-wider text-slate-400 mb-3 font-medium">
        {title}
      </h2>
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: '0.5px solid var(--csn-border-strong)' }}
      >
        {children}
      </div>
    </div>
  )
}

function rolePill(role: string) {
  const styles: Record<string, { bg: string; color: string }> = {
    USER:      { bg: '#e6f1fb', color: '#185fa5' },
    ADMIN:     { bg: '#eededf', color: '#7a1a2e' },
    SUPERUSER: { bg: '#eeedfe', color: '#3c3489' },
  }
  const labels: Record<string, string> = {
    USER: 'user', ADMIN: 'admin', SUPERUSER: 'superuser',
  }
  const s = styles[role] || styles.USER
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {labels[role]}
    </span>
  )
}

function statusPill(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDING:  { bg: '#fff3cd', color: '#7a5a00', label: 'En attente' },
    ACTIVE:   { bg: '#eaf7f0', color: '#1a6642', label: 'Actif' },
    DISABLED: { bg: '#f5f5f5', color: '#666',    label: 'Désactivé' },
  }
  const s = map[status] || map.PENDING
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function UserRow({
  user,
  currentUserId,
}: {
  user: { id: string; email: string; firstName: string; lastName: string; role: string; status: string; createdAt: Date }
  currentUserId: string
}) {
  const isSelf = user.id === currentUserId

  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{ borderBottom: '0.5px solid var(--csn-border)' }}
    >
      {/* Avatar initiales */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0"
        style={{ background: 'var(--csn-light)', color: 'var(--csn-navy)' }}
      >
        {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
      </div>

      {/* Email + nom */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--csn-navy)' }}>
          {user.email}
          {isSelf && (
            <span className="ml-2 text-[11px] text-slate-400">(vous)</span>
          )}
        </div>
        {(user.firstName || user.lastName) && (
          <div className="text-[12px] text-slate-400">
            {user.firstName} {user.lastName}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2">
        {rolePill(user.role)}
        {statusPill(user.status)}
      </div>

      {/* Actions */}
      {!isSelf && (
        <UserActionsBar
          userId={user.id}
          status={user.status}
          currentRole={user.role}
        />
      )}
    </div>
  )
}
