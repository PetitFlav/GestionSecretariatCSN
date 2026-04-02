import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  return (
    <AppLayout user={user}>
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-4">

        {/* Bouton Importation — en avant, pleine largeur */}
        <Link
          href="/import"
          className="flex items-center gap-4 rounded-xl px-5 py-4 text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--csn-navy)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-medium">Importation</div>
            <div className="text-[11px] opacity-70 mt-0.5">Importer un fichier Excel VPdive</div>
          </div>
        </Link>

        {/* Boutons secondaires côte à côte */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/adherents"
            className="flex flex-col gap-2.5 rounded-xl p-4 bg-white transition-colors hover:bg-slate-50"
            style={{ border: '0.5px solid var(--csn-border-strong)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--csn-light)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--csn-navy)" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M2 10h20"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
                Édition des étiquettes
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Générer et imprimer</div>
            </div>
          </Link>

          <Link
            href="/attestations"
            className="flex flex-col gap-2.5 rounded-xl p-4 bg-white transition-colors hover:bg-slate-50"
            style={{ border: '0.5px solid var(--csn-border-strong)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--csn-light)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--csn-navy)" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--csn-navy)' }}>
                Envoi attestation
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">PDF par email</div>
            </div>
          </Link>
        </div>

      </div>
    </AppLayout>
  )
}
