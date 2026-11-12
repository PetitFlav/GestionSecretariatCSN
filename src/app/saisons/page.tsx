import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getSaisons } from '@/app/actions/import'
import SaisonsClient from './SaisonsClient'

export default async function SaisonsPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')
  // Page réservée aux administrateurs (spec demande d'accueil § 8)
  if (user.role !== 'ADMIN' && user.role !== 'SUPERUSER') redirect('/')

  const saisons = await getSaisons()

  // Modèles PDF de demande d'accueil : uniquement la date, jamais le PDF
  const modeles = await prisma.modeleDemande.findMany({
    select: { saisonId: true, updatedAt: true },
  })
  const modeleParSaison = new Map(modeles.map(m => [m.saisonId, m.updatedAt]))

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-[16px] font-medium mb-6" style={{ color: 'var(--csn-navy)' }}>
          Gestion des saisons
        </h1>
        <SaisonsClient
          saisons={saisons.map(s => ({ ...s, modeleDemandeMaj: modeleParSaison.get(s.id) ?? null }))}
        />
      </div>
    </AppLayout>
  )
}
