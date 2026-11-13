import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { estInvite } from '@/lib/invite'
import { ordreDateFr } from '@/lib/saisons'
import BureauClient from './BureauClient'

// Toujours relu à l'affichage : après un ajout / retrait, router.refresh()
// recharge les données à jour.
export const dynamic = 'force-dynamic'

export default async function BureauPage({
  searchParams,
}: {
  searchParams: { saison?: string }
}) {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')
  if (user.role !== 'ADMIN' && user.role !== 'SUPERUSER') redirect('/')

  // Saisons, de la plus récente à la plus ancienne (dateDebut convertie)
  const saisons = (await prisma.saison.findMany({
    select: { id: true, label: true, isActive: true, dateDebut: true },
  })).sort((a, b) => (ordreDateFr(b.dateDebut) ?? 0) - (ordreDateFr(a.dateDebut) ?? 0))

  const saison =
    saisons.find(s => s.id === searchParams.saison) ??
    saisons.find(s => s.isActive) ??
    saisons[0]

  const [fonctions, affectations, adherents] = saison
    ? await Promise.all([
        prisma.fonction.findMany({
          where: { actif: true }, orderBy: { ordre: 'asc' },
          select: { id: true, code: true, libelle: true },
        }),
        prisma.adherentFonction.findMany({
          where:  { adherent: { saisonId: saison.id } },
          select: { id: true, fonctionId: true, adherent: { select: { id: true, nom: true, prenom: true } } },
        }),
        prisma.adherent.findMany({
          where:   { saisonId: saison.id },
          select:  { id: true, nom: true, prenom: true, licence: true },
          orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        }),
      ])
    : [[], [], []]

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Bureau
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Fonctions des membres du bureau, par saison. Le président·e et son
            courriel figurent sur les demandes d&apos;accueil piscine.
          </p>
        </div>

        {!saison ? (
          <div className="rounded-xl p-5 text-[13px]"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            Aucune saison configurée. Créez d&apos;abord une saison dans{' '}
            <a href="/saisons" className="underline">Gestion des saisons</a>.
          </div>
        ) : (
          <BureauClient
            saisons={saisons.map(s => ({ id: s.id, label: s.label, isActive: s.isActive }))}
            saisonId={saison.id}
            fonctions={fonctions}
            membres={affectations.map(a => ({
              affectationId: a.id, fonctionId: a.fonctionId,
              adherentId: a.adherent.id, nom: a.adherent.nom, prenom: a.adherent.prenom,
            }))}
            // Les invités ne sont pas membres du club : jamais au bureau
            adherents={adherents
              .filter(a => !estInvite(a.licence))
              .map(a => ({ id: a.id, nom: a.nom, prenom: a.prenom }))}
          />
        )}
      </div>
    </AppLayout>
  )
}
