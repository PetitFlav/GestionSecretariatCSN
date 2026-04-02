import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'

export default async function ImportPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  return (
    <AppLayout user={user}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-[16px] font-medium mb-2" style={{ color: 'var(--csn-navy)' }}>
          Importation
        </h1>
        <p className="text-[13px] text-slate-400">
          Import du fichier Excel VPdive — à développer en Phase 2.
        </p>
      </div>
    </AppLayout>
  )
}
