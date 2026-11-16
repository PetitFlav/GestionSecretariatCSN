'use server'

import { requireAuth } from '@/lib/session'
import { calculerStats, type StatsData } from '@/lib/statistiques-serveur'

// Le calcul est dans lib/statistiques-serveur.ts (partagé avec la page d'AG
// en lecture seule) ; ici, uniquement le contrôle d'accès.
export type {
  StatSaison, StatLigne, TypeReinscription, StatReinscription, StatsData,
} from '@/lib/statistiques-serveur'

export async function getStatsData(): Promise<StatsData> {
  await requireAuth()
  return calculerStats()
}
