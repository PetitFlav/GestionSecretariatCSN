import { redirect, notFound } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { getAdherentDetail } from '@/app/actions/adherents'
import { BoutonEtiquette, BoutonAttestation, TogglePassager } from './AdherentButtons'

interface Props {
  params: { id: string }
}

export default async function AdherentDetailPage({ params }: Props) {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const a = await getAdherentDetail(params.id)
  if (!a) notFound()

  const adresseVPdive = [a.adresse, a.codePostal, a.ville].filter(Boolean).join(' ')
  const adresseFFESSM = [a.ffessmAdresse, a.ffessmCodePostal, a.ffessmVille].filter(Boolean).join(' ')
  const adressesDifferentes = adresseVPdive && adresseFFESSM && adresseVPdive !== adresseFFESSM

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* En-tête */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[18px] font-medium" style={{ color: 'var(--csn-navy)' }}>
                {a.prenom} {a.nom}
              </h1>
              {a.passager && (
                <span className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: '#f1f5f9', color: '#64748b', border: '0.5px solid #cbd5e1' }}>
                  passager
                </span>
              )}
              {a.adresseDesync && (
                <span className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: '#fff3cd', color: '#7a5a00', border: '0.5px solid #e8c96a' }}>
                  ⚠ Adresse désync FFESSM
                </span>
              )}
            </div>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {a.civilite} — Licence {a.licence ?? 'N/A'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <BoutonEtiquette adherentId={a.id} />
            <BoutonAttestation adherentId={a.id} />
          </div>
        </div>

        {/* Statut passager */}
        <Section title="Statut d'adhésion">
          <div className="py-3">
            <TogglePassager adherentId={a.id} initialValue={a.passager} />
            <p className="text-[11px] text-slate-400 mt-2">
              Un passager adhère au club mais prend sa licence FFESSM dans un autre club.
              Il n&apos;apparaîtra pas comme &quot;non assuré&quot; dans le suivi.
            </p>
          </div>
        </Section>

        {/* Informations personnelles */}
        <Section title="Informations">
          <Row label="Date de naissance" value={a.dateNaissance} />
          <Row label="Email"             value={a.email} />
        </Section>

        {/* Adresses — VPdive vs FFESSM */}
        <Section title="Adresses">
          <div className="grid grid-cols-2 gap-4 py-3">
            {/* Adresse VPdive */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                VPdive
              </div>
              <div className="rounded-lg p-3"
                style={{
                  background: adressesDifferentes ? '#fff8e6' : 'var(--csn-cream)',
                  border: `0.5px solid ${adressesDifferentes ? '#e8c96a' : 'var(--csn-border)'}`,
                }}>
                {a.adresse && <div className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>{a.adresse}</div>}
                {(a.codePostal || a.ville) && (
                  <div className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>
                    {[a.codePostal, a.ville].filter(Boolean).join(' ')}
                  </div>
                )}
                {!adresseVPdive && <div className="text-[12px] text-slate-400">—</div>}
              </div>
            </div>

            {/* Adresse FFESSM */}
            <div>
              <div className="text-[11px] text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                FFESSM
              </div>
              <div className="rounded-lg p-3"
                style={{
                  background: adressesDifferentes ? '#fff8e6' : 'var(--csn-cream)',
                  border: `0.5px solid ${adressesDifferentes ? '#e8c96a' : 'var(--csn-border)'}`,
                }}>
                {a.ffessmAdresse && <div className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>{a.ffessmAdresse}</div>}
                {(a.ffessmCodePostal || a.ffessmVille) && (
                  <div className="text-[13px]" style={{ color: 'var(--csn-navy)' }}>
                    {[a.ffessmCodePostal, a.ffessmVille].filter(Boolean).join(' ')}
                  </div>
                )}
                {!adresseFFESSM && (
                  <div className="text-[12px] text-slate-400">
                    {a.ffessmId ? '—' : 'Non enregistré FFESSM'}
                  </div>
                )}
              </div>
            </div>
          </div>
          {adressesDifferentes && (
            <div className="pb-2 text-[12px]" style={{ color: '#7a5a00' }}>
              ⚠ Les deux adresses sont différentes — vérifiez et mettez à jour sur le portail FFESSM si nécessaire.
            </div>
          )}
        </Section>

        {/* Cotisation */}
        <Section title="Cotisation">
          <Row label="Montant"                  value={a.montant} />
          <Row label="Date(s) paiement"         value={a.datePaiement} />
          <Row label="Expiration licence FFESSM" value={a.dateExpiration} />
          <Row label="CACI (certificat médical)"
            value={a.caci}
            highlight={caciHighlight(a.caci)}
          />
        </Section>

        {/* FFESSM */}
        <Section title="FFESSM">
          <Row label="Identifiant FFESSM" value={a.ffessmId} />
          <Row label="Statut validation"
            value={a.ffessmStatut
              ? ({ VALIDE: 'Validé', EN_ATTENTE: 'En attente', NON_SOUMIS: 'Non soumis' } as Record<string, string>)[a.ffessmStatut] ?? a.ffessmStatut
              : null
            }
          />
        </Section>

        {/* Historique impressions */}
        <Section title={`Impressions (${a.impressions.length})`}>
          {a.impressions.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-2">Aucune impression enregistrée.</p>
          ) : (
            a.impressions.map(imp => (
              <div key={imp.id} className="flex justify-between items-center py-2"
                style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
                <span className="text-[12px] text-slate-500">
                  {new Date(imp.printedAt).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: imp.status === 'PRINTED' ? '#eaf7f0' : '#f1f5f9', color: imp.status === 'PRINTED' ? '#1a6642' : '#64748b' }}>
                  {imp.status === 'PRINTED' ? 'Imprimé' : 'Simulé'}
                </span>
              </div>
            ))
          )}
        </Section>

        {/* Historique attestations */}
        <Section title={`Attestations (${a.attestations.length})`}>
          {a.attestations.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-2">Aucune attestation envoyée.</p>
          ) : (
            a.attestations.map(att => (
              <div key={att.id} className="flex justify-between items-center py-2"
                style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
                <span className="text-[12px] text-slate-500">
                  {new Date(att.sentAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
                <span className="text-[12px] text-slate-400">{att.email ?? '—'}</span>
              </div>
            ))
          )}
        </Section>

      </div>
    </AppLayout>
  )
}

// ── Composants ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-2">{title}</h2>
      <div className="bg-white rounded-xl px-4 py-1" style={{ border: '0.5px solid var(--csn-border-strong)' }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: {
  label: string
  value: string | null | undefined
  highlight?: 'red' | 'orange' | 'green' | null
}) {
  const colors = { red: '#dc2626', orange: '#d97706', green: '#16a34a' }
  return (
    <div className="flex justify-between items-center py-2.5"
      style={{ borderBottom: '0.5px solid var(--csn-border)' }}>
      <span className="text-[12px] text-slate-400">{label}</span>
      <span className="text-[13px] font-medium"
        style={{ color: highlight ? colors[highlight] : 'var(--csn-navy)' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function caciHighlight(dateStr: string | null): 'red' | 'orange' | 'green' | null {
  if (!dateStr) return null
  try {
    const [d, m, y] = dateStr.split('/')
    const diff = Math.floor((new Date(+y, +m - 1, +d).getTime() - Date.now()) / 86400000)
    if (diff < 0)  return 'red'
    if (diff < 90) return 'orange'
    return 'green'
  } catch { return null }
}
