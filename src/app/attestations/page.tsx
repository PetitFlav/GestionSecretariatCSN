import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisonActive } from '@/app/actions/adherents'
import AttestationsList from './AttestationsList'

export default async function AttestationsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')
  const saison = await getSaisonActive()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Envoi des attestations
          </h1>
          {saison && <p className="text-[12px] text-slate-400 mt-0.5">Saison {saison.label}</p>}
        </div>
        {saison ? (
          <AttestationsList saisonId={saison.id} saisonLabel={saison.label} />
        ) : (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison active.
          </div>
        )}
      </div>
    </AppLayout>
  )
}
