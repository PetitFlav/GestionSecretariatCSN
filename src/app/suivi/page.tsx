import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getSaisonActive, getSuivi, AlerteFFESSM } from '@/app/actions/adherents'
import SuiviCaciSection from './SuiviCaciSection'

export default async function SuiviPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const saison = await getSaisonActive()
  if (!saison) {
    return (
      <AppLayout user={user} showBack={true}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison active.
          </div>
        </div>
      </AppLayout>
    )
  }

  const suivi = await getSuivi(saison.id)
  const totalProblemes = suivi.caciExpires.length + suivi.caciExpirentBientot.length
    + suivi.ffessmAbsents.length + suivi.ffessmDesync.length

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>Suivi & alertes</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Saison {saison.label}</p>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-medium"
              style={{ color: suivi.totalAssures === suivi.totalAdherents ? '#16a34a' : '#d97706' }}>
              {suivi.totalAssures} / {suivi.totalAdherents}
            </div>
            <div className="text-[11px] text-slate-400">assurés FFESSM</div>
          </div>
        </div>

        {totalProblemes === 0 && (
          <div className="rounded-xl p-5 text-[13px] text-center"
            style={{ background: '#eaf7f0', border: '0.5px solid #7dd4a8', color: '#1a6642' }}>
            ✓ Aucun problème détecté.
          </div>
        )}

        {/* FFESSM non assurés */}
        {suivi.ffessmAbsents.length > 0 && (
          <FFESSMSection title="Non enregistrés FFESSM" count={suivi.ffessmAbsents.length} severity="critical"
            description="Ces adhérents ont payé leur cotisation mais ne sont pas enregistrés sur le portail FFESSM. Ils ne sont pas assurés.">
            {suivi.ffessmAbsents.map(a => <AlertRow key={a.id} a={a} />)}
          </FFESSMSection>
        )}

        {/* FFESSM désync */}
        {suivi.ffessmDesync.length > 0 && (
          <FFESSMSection title="Adresse désynchronisée FFESSM" count={suivi.ffessmDesync.length} severity="warning"
            description="Ces adhérents sont enregistrés sur FFESSM mais leur adresse diffère de VPdive.">
            {suivi.ffessmDesync.map(a => <AlertRow key={a.id} a={a} />)}
          </FFESSMSection>
        )}

        {/* CACI expirés — interactif */}
        {suivi.caciExpires.length > 0 && (
          <SuiviCaciSection
            title="CACI expirés ou manquants"
            count={suivi.caciExpires.length}
            severity="critical"
            description="Ces adhérents ne peuvent plus pratiquer légalement. Le certificat médical doit être renouvelé."
            alertes={suivi.caciExpires}
            type="expire"
            saisonId={saison.id}
          />
        )}

        {/* CACI bientôt expirés — interactif */}
        {suivi.caciExpirentBientot.length > 0 && (
          <SuiviCaciSection
            title="CACI expirent dans moins de 90 jours"
            count={suivi.caciExpirentBientot.length}
            severity="warning"
            description="Ces adhérents doivent renouveler leur certificat médical prochainement."
            alertes={suivi.caciExpirentBientot}
            type="bientot"
            saisonId={saison.id}
          />
        )}
      </div>
    </AppLayout>
  )
}

function FFESSMSection({ title, count, severity, description, children }: {
  title: string; count: number; severity: 'critical' | 'warning'
  description: string; children: React.ReactNode
}) {
  const c = severity === 'critical'
    ? { border: '#fca5a5', bg: '#fff5f5', dot: '#dc2626' }
    : { border: '#e8c96a', bg: '#fffdf0', dot: '#d97706' }
  return (
    <div className="mb-5 rounded-xl overflow-hidden" style={{ border: `0.5px solid ${c.border}` }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: c.bg, borderBottom: `0.5px solid ${c.border}` }}>
        <div className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
        <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>{title}</span>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium text-white" style={{ background: c.dot }}>{count}</span>
      </div>
      <p className="px-4 py-2 text-[12px] text-slate-400" style={{ background: c.bg }}>{description}</p>
      <div className="bg-white">{children}</div>
    </div>
  )
}

function AlertRow({ a }: { a: AlerteFFESSM }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>{a.prenom} {a.nom}</span>
        {a.passager && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: '#f1f5f9', color: '#64748b', border: '0.5px solid #cbd5e1' }}>passager</span>
        )}
        {a.detail && <span className="ml-2 text-[12px] text-slate-400">{a.detail}</span>}
      </div>
      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{
          background: a.type === 'absent' ? '#fee2e2' : '#fff3cd',
          color:      a.type === 'absent' ? '#dc2626' : '#7a5a00',
        }}>
        {a.type === 'absent' ? 'Non assuré' : 'Adresse diff.'}
      </span>
      <Link href={`/adherents/${a.id}`}
        className="text-[11px] px-2 py-1 rounded border hover:bg-slate-50 flex-shrink-0"
        style={{ borderColor: 'var(--csn-border)', color: 'var(--csn-blue)' }}>→</Link>
    </div>
  )
}
