/**
 * src/lib/saisons.ts
 *
 * Ordre chronologique des saisons et recherche de la saison précédente.
 * Utilisé par l'écran « Bureau » (reprise du bureau) et par la demande
 * d'accueil piscine (président de la saison précédente s'il n'est pas encore
 * réinscrit). Spec : docs/SPEC-demande-accueil.md § 8.
 *
 * Saison.dateDebut est un texte JJ/MM/AAAA : on le convertit avant de trier
 * (un tri sur le texte mettrait « 01/09/2026 » avant « 15/08/2025 »).
 */

import { prisma } from '@/lib/db'

/** « JJ/MM/AAAA » → nombre AAAAMMJJ, comparable ; null si le format est invalide. */
export function ordreDateFr(dateFr: string | null | undefined): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateFr?.trim() ?? '')
  return m ? parseInt(m[3]) * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]) : null
}

/**
 * Saison qui précède `saisonId` (dateDebut immédiatement antérieure),
 * ou null s'il n'y en a pas. Les saisons à dateDebut illisible sont ignorées.
 */
export async function getSaisonPrecedente(
  saisonId: string,
): Promise<{ id: string; label: string } | null> {
  const saisons = await prisma.saison.findMany({
    select: { id: true, label: true, dateDebut: true },
  })
  const courante = saisons.find(s => s.id === saisonId)
  const ordreCourant = ordreDateFr(courante?.dateDebut)
  if (ordreCourant === null) return null

  let meilleure: { id: string; label: string; ordre: number } | null = null
  for (const s of saisons) {
    const ordre = ordreDateFr(s.dateDebut)
    if (ordre === null || ordre >= ordreCourant) continue
    if (!meilleure || ordre > meilleure.ordre) meilleure = { id: s.id, label: s.label, ordre }
  }
  return meilleure ? { id: meilleure.id, label: meilleure.label } : null
}
