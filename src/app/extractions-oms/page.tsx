import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisons } from '@/app/actions/import'
import ExtractionsOmsClient from './ExtractionsOmsClient'

export default async function ExtractionsOmsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const saisons = await getSaisons()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Extractions O.M.S
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Générer l&apos;extraction des adhérents d&apos;une saison au format attendu par
            l&apos;Office Municipal des Sports. Chaque saison reste disponible même après
            le passage à la suivante.
          </p>
        </div>

        {saisons.length === 0 ? (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison configurée. Créez d&apos;abord une saison dans{' '}
            <a href="/saisons" className="underline">Gestion des saisons</a>.
          </div>
        ) : (
          <ExtractionsOmsClient saisons={saisons.map(s => ({ id: s.id, label: s.label, isActive: s.isActive }))} />
        )}
      </div>
    </AppLayout>
  )
}
