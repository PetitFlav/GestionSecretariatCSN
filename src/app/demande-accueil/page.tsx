import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { chargerContexte } from '@/lib/demande-accueil-serveur'
import DemandeAccueilClient from './DemandeAccueilClient'

// Toujours relu (historique, téléphones mémorisés, président…)
export const dynamic = 'force-dynamic'

export default async function DemandeAccueilPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const ctx = await chargerContexte(user)
  const estAdmin = user.role === 'ADMIN' || user.role === 'SUPERUSER'

  // Blocages : rien à saisir tant qu'ils ne sont pas levés
  const blocages: string[] = []
  if (!ctx.saison) blocages.push('Aucune saison active.')
  else if (!ctx.modelePresent) {
    blocages.push(
      `Aucun modèle PDF n'est chargé pour la saison ${ctx.saison.label}. ` +
      (estAdmin ? 'Chargez-le dans Gestion des saisons.' : 'Contactez un administrateur.'),
    )
  }
  if (ctx.saison && !ctx.president) {
    blocages.push(
      "Aucun président·e n'est désigné, ni sur la saison active ni sur la précédente. " +
      (estAdmin ? 'Désignez-le dans Config → Bureau.' : 'Contactez un administrateur (écran Bureau).'),
    )
  }
  if (ctx.types.length === 0) blocages.push('Aucun type de demande actif (table types_demande).')

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Demande d&apos;accueil piscine Léo Lagrange
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Baptêmes, initiations, invitations : le formulaire de la Ville est rempli
            automatiquement et envoyé au Service des Piscines depuis votre adresse.
            {ctx.saison && <> Saison {ctx.saison.label}.</>}
          </p>
        </div>

        {blocages.length > 0 ? (
          <div className="rounded-xl p-5 text-[13px] flex flex-col gap-2"
            style={{ background: '#fff8e6', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
            {blocages.map(b => <div key={b}>{b}</div>)}
          </div>
        ) : (
          <DemandeAccueilClient ctx={ctx} />
        )}
      </div>
    </AppLayout>
  )
}
