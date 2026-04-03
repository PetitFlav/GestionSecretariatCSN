import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisons } from '@/app/actions/import'
import SaisonsClient from './SaisonsClient'

export default async function SaisonsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const saisons = await getSaisons()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-[16px] font-medium mb-6" style={{ color: 'var(--csn-navy)' }}>
          Gestion des saisons
        </h1>
        <SaisonsClient saisons={saisons} />
      </div>
    </AppLayout>
  )
}
