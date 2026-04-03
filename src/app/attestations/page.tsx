import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'

export default async function AttestationsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-[16px] font-medium mb-2" style={{ color: 'var(--csn-navy)' }}>
          Envoi d&apos;attestations
        </h1>
        <p className="text-[13px] text-slate-400">
          Génération et envoi des attestations PDF par email — à développer en Phase 4.
        </p>
      </div>
    </AppLayout>
  )
}
