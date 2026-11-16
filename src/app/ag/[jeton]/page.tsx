import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { jetonAgValide, expirationAg } from '@/lib/acces-ag'
import { calculerStats } from '@/lib/statistiques-serveur'
import { calculerDiplomes } from '@/lib/diplomes-serveur'
import StatistiquesClient from '@/app/statistiques/StatistiquesClient'

// ── Statistiques pour la présentation d'AG (lien secret, lecture seule) ──────
// Ouverte depuis le smiley du PowerPoint d'AG, SANS connexion : voir
// lib/acces-ag.ts pour les garde-fous. Aucune session n'est créée ; la page
// n'affiche que des comptages agrégés et aucun lien vers le reste de l'appli.
// Route déclarée publique dans middleware.ts.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Statistiques — AG CSN',
  // Pas d'indexation, et le jeton ne fuit pas dans l'en-tête Referer
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function StatistiquesAgPage({ params }: { params: { jeton: string } }) {
  // Jeton faux, absent, expiré ou accès désactivé → 404 (aucun indice donné)
  if (!jetonAgValide(params.jeton)) notFound()

  const [data, diplomes] = await Promise.all([calculerStats(), calculerDiplomes()])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--csn-cream)' }}>
      <header className="bg-white border-b flex items-center gap-3 px-5 h-[52px] flex-shrink-0"
        style={{ borderColor: 'var(--csn-border-strong)' }}>
        <Image src="/logo-csn.png" alt="Logo CSN" width={36} height={36} className="object-contain" priority />
        <div className="w-px h-6" style={{ background: 'var(--csn-border-strong)' }} />
        <span className="text-[13px] font-medium tracking-wide" style={{ color: 'var(--csn-navy)' }}>
          Centre Subaquatique Nantais — Assemblée générale
        </span>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-5">
            <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
              Statistiques
            </h1>
            <p className="text-[13px] text-slate-400 mt-1">
              Indicateurs sur les adhérents, par saison et par section — consultation seule
              {expirationAg() ? ` (lien valable jusqu'au ${expirationAg()})` : ''}.
            </p>
          </div>

          {data.saisons.length === 0
            ? <p className="text-[13px] text-slate-400">Aucune saison configurée.</p>
            : <StatistiquesClient data={data} diplomes={diplomes} lectureSeule />}
        </div>
      </main>
    </div>
  )
}
