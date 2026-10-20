import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getStatsData } from '@/app/actions/statistiques'
import StatistiquesClient from './StatistiquesClient'

// Toujours recalculé à l'affichage (pas de cache de page) : un import fait
// juste avant l'AG doit apparaître immédiatement.
export const dynamic = 'force-dynamic'

export default async function StatistiquesPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const data = await getStatsData()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-5">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Statistiques
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Indicateurs sur les adhérents, par saison et par section.
          </p>
        </div>

        {data.saisons.length === 0 ? (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison configurée. Créez d&apos;abord une saison dans{' '}
            <a href="/saisons" className="underline">Gestion des saisons</a>.
          </div>
        ) : (
          <StatistiquesClient data={data} />
        )}
      </div>
    </AppLayout>
  )
}
