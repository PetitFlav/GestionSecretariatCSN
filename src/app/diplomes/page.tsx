import { redirect } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/db'
import { calculerDiplomes } from '@/lib/diplomes-serveur'
import { ORDRE_FAMILLES, FAMILLE_AUTRES, classerBrevet, ordreFamilles } from '@/lib/brevets'
import SaisieDiplome from './SaisieDiplome'
import ImportBrevets from './ImportBrevets'

// ── Gestion des diplômes ─────────────────────────────────────────────────────
// Saisie manuelle d'un diplôme pour un adhérent + import de l'export FFESSM
// « Liste des brevets » (déplacé ici depuis la page Statistiques).

// Toujours relu : un import ou une saisie doit apparaître tout de suite
export const dynamic = 'force-dynamic'

const carteStyle = { border: '0.5px solid var(--csn-border-strong)' }

export default async function DiplomesPage() {
  const user = await getSessionUser()
  if (!user || user.status !== 'ACTIVE') redirect('/login')

  const [saisons, niveaux, choix, recap] = await Promise.all([
    prisma.saison.findMany({
      select:  { id: true, label: true, isActive: true },
      orderBy: { label: 'desc' },
    }),
    // Libellés déjà connus (import + saisies) → propositions à la saisie
    prisma.brevet.findMany({ distinct: ['niveau'], select: { niveau: true } }),
    // Catégories déjà choisies à la saisie (la plus récente l'emporte)
    prisma.brevet.findMany({
      where: { famille: { not: null } }, select: { niveau: true, famille: true }, orderBy: { createdAt: 'asc' },
    }),
    calculerDiplomes(),
  ])
  const libelles = niveaux.map(n => n.niveau).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))

  // Diplôme → catégorie à pré-remplir : dernière choisie, sinon celle des règles
  const famillesChoisies: Record<string, string> = {}
  for (const c of choix) famillesChoisies[c.niveau] = c.famille as string
  // Catégories proposées : celles des règles + celles des diplômes en base
  // (dont les catégories ajoutées à la saisie), sans « Autres »
  const familles = ordreFamilles([
    ...ORDRE_FAMILLES,
    ...libelles.map(n => classerBrevet(n).famille),
    ...Object.values(famillesChoisies),
  ]).filter(f => f !== FAMILLE_AUTRES)

  return (
    <AppLayout user={user} showBack={true}>
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <div>
          <h1 className="text-[16px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Gestion des diplômes
          </h1>
          <p className="text-[13px] text-slate-400 mt-1">
            Diplômes obtenus au club, comptés dans les statistiques : import de l&apos;export FFESSM
            ou saisie à la main pour un adhérent.
          </p>
        </div>

        <section className="bg-white rounded-xl p-5 flex flex-col gap-4" style={carteStyle}>
          <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>Ajouter un diplôme</h2>
          <SaisieDiplome saisons={saisons} niveaux={libelles}
            familles={familles} famillesChoisies={famillesChoisies} />
        </section>

        <section className="bg-white rounded-xl p-5 flex flex-col gap-4" style={carteStyle}>
          <h2 className="text-[14px] font-medium" style={{ color: 'var(--csn-navy)' }}>
            Importer l&apos;export FFESSM « Liste des brevets »
          </h2>
          <ImportBrevets />
          <div className="text-[12px] text-slate-500">
            {recap.saisons.length === 0 ? 'Aucun diplôme en base.' : (
              <ul className="space-y-0.5">
                {recap.saisons.map(s => (
                  <li key={s.saison}>
                    <span className="font-medium" style={{ color: 'var(--csn-navy)' }}>{s.saison}</span>
                    {' '}: {s.total} diplôme{s.total > 1 ? 's' : ''}
                    {s.importeLe ? ` — export FFESSM importé le ${s.importeLe}` : ' — aucun import FFESSM'}
                    {s.saisis ? `, dont ${s.saisis} saisi${s.saisis > 1 ? 's' : ''} à la main` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}
