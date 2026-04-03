import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisonActive } from '@/app/actions/adherents'
import AdherentsList from './AdherentsList'

export default async function AdherentsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const saison = await getSaisonActive()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
              Adhérents
            </h1>
            {saison && (
              <p className="text-[12px] text-slate-400 mt-0.5">
                Saison {saison.label} — {saison.dateDebut} au {saison.dateFin}
              </p>
            )}
          </div>
        </div>
        {saison ? (
          <AdherentsList saisonId={saison.id} saisonLabel={saison.label} />
        ) : (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison active. Créez une saison dans Config → Gestion des saisons.
          </div>
        )}
      </div>
    </AppLayout>
  )
}
