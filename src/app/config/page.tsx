import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { loadSmtpConfig } from '@/app/actions/smtp-config'
import SmtpConfigForm from './SmtpConfigForm'

export default async function ConfigPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const smtpConfig = await loadSmtpConfig()

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
          Configuration
        </h1>

        {/* Mon compte email */}
        <Section title="Mon compte email">
          <p className="text-[12px] text-slate-400 mb-4 leading-relaxed">
            Configurez votre compte email personnel pour l&apos;envoi des attestations.
            Vos identifiants sont chiffrés et <strong>invisibles</strong> de tous les autres
            utilisateurs, y compris les administrateurs.
          </p>
          <SmtpConfigForm initialConfig={smtpConfig} />
        </Section>

        {/* Variables d'environnement */}
        <Section title="Variables d'environnement système">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
                  <th className="text-left py-2 pr-4 text-slate-400 font-medium">Variable</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Description</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'ENCRYPTION_KEY',  desc: 'Clé chiffrement données personnelles', ok: !!process.env.ENCRYPTION_KEY },
                  { key: 'SESSION_SECRET',  desc: 'Secret de session HTTP',               ok: !!process.env.SESSION_SECRET },
                  { key: 'DATABASE_URL',    desc: 'Base de données Supabase',              ok: !!process.env.DATABASE_URL },
                ].map(({ key, desc, ok }) => (
                  <tr key={key} style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
                    <td className="py-2 pr-4">
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]"
                        style={{ color: 'var(--csn-navy)' }}>{key}</code>
                    </td>
                    <td className="py-2 text-slate-500 pr-4">{desc}</td>
                    <td className="py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: ok ? '#eaf7f0' : '#fee2e2', color: ok ? '#1a6642' : '#dc2626' }}>
                        {ok ? '✓ OK' : '✗ Manquant'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
    </AppLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid var(--csn-border-strong)' }}>
      <h2 className="text-[13px] font-medium mb-4" style={{ color: 'var(--csn-navy)' }}>{title}</h2>
      {children}
    </div>
  )
}
