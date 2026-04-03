import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'

export default async function ConfigPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-[16px] font-medium mb-6" style={{ color: 'var(--csn-navy)' }}>
          Configuration
        </h1>

        <div
          className="bg-white rounded-xl p-5"
          style={{ border: '0.5px solid var(--csn-border-strong)' }}
        >
          <h2 className="text-[13px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
            SMTP — Envoi d&apos;emails
          </h2>
          <p className="text-[12px] text-slate-400 mb-3">
            La configuration SMTP est gérée via les variables d&apos;environnement Vercel.
            Renseignez <code className="bg-slate-100 px-1 rounded text-[11px]">SMTP_HOST</code>,{' '}
            <code className="bg-slate-100 px-1 rounded text-[11px]">SMTP_USER</code>,{' '}
            <code className="bg-slate-100 px-1 rounded text-[11px]">SMTP_PASS</code> et{' '}
            <code className="bg-slate-100 px-1 rounded text-[11px]">SMTP_FROM</code> dans
            les settings de votre projet Vercel.
          </p>
          <div
            className="rounded-lg px-3 py-2.5 text-[12px]"
            style={{
              background: 'var(--csn-cream)',
              border: '0.5px solid var(--csn-border)',
              color: '#64748b',
            }}
          >
            En attendant la configuration SMTP, les liens de création de mot de passe
            s&apos;affichent dans les logs du serveur (console Vercel ou terminal local).
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
