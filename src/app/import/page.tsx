import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisons } from '@/app/actions/import'
import ImportForm from './ImportForm'

export default async function ImportPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const saisons = await getSaisons()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Importation VPdive
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Importez les fichiers Excel exportés depuis VPdive pour alimenter la base adhérents.
          </p>
        </div>

        {saisons.length === 0 ? (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison configurée. Créez d&apos;abord une saison dans{' '}
            <a href="/saisons" className="underline">Gestion des saisons</a>.
          </div>
        ) : (
          <ImportForm saisons={saisons} />
        )}
      </div>
    </AppLayout>
  )
}
