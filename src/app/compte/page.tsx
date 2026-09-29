import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import ChangePasswordForm from './ChangePasswordForm'

export default async function ComptePage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-md mx-auto px-4 py-8 flex flex-col gap-5">
        <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
          Mon compte
        </h1>

        <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid var(--csn-border-strong)' }}>
          <p className="text-[12px] text-slate-400 mb-1">Connecté en tant que</p>
          <p className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>{user.email}</p>
        </div>

        <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid var(--csn-border-strong)' }}>
          <h2 className="text-[13px] font-medium mb-4" style={{ color: 'var(--csn-navy)' }}>
            Changer mon mot de passe
          </h2>
          <ChangePasswordForm />
        </div>
      </div>
    </AppLayout>
  )
}
