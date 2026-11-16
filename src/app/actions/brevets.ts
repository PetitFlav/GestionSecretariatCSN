'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { parseBrevets } from '@/lib/parsers/brevets'
import { calculerDiplomes, type DiplomesData } from '@/lib/diplomes-serveur'

// ── Diplômes (brevets FFESSM) pour les statistiques ──────────────────────────
// Le calcul est dans lib/diplomes-serveur.ts (partagé avec la page d'AG en
// lecture seule) ; ici, uniquement le contrôle d'accès.
export type { DiplomesData, DiplomesSaison } from '@/lib/diplomes-serveur'

export async function getDiplomesData(): Promise<DiplomesData> {
  await requireAuth()
  return calculerDiplomes()
}

export interface ImportBrevetsResult {
  success:    boolean
  error?:     string
  saison?:    string
  nb?:        number
  remplaces?: number   // brevets de la même saison supprimés avant l'import
  erreurs?:   string[]
}

/**
 * Importe un export FFESSM « Liste des brevets ».
 * La saison est lue dans le fichier ; ses brevets déjà en base sont REMPLACÉS
 * (réimporter le même fichier ne crée pas de doublons, et un export plus
 * récent de la saison en cours met simplement les chiffres à jour).
 */
export async function importerBrevets(formData: FormData): Promise<ImportBrevetsResult> {
  try {
    await requireAuth()
  } catch {
    return { success: false, error: 'Non authentifié' }
  }

  const fichier = formData.get('brevets') as File | null
  if (!fichier || fichier.size === 0) return { success: false, error: 'Aucun fichier sélectionné' }

  const { saison, brevets, errors } = parseBrevets(await fichier.arrayBuffer())
  if (!saison || brevets.size === 0) {
    return { success: false, error: errors[0] ?? 'Fichier illisible', erreurs: errors.slice(1) }
  }

  const donnees = Array.from(brevets.values()).map(b => ({ saison, ...b }))

  // Suppression + création dans une même transaction : en cas d'échec, les
  // anciens chiffres de la saison restent intacts.
  const [supprimes] = await prisma.$transaction([
    prisma.brevet.deleteMany({ where: { saison } }),
    prisma.brevet.createMany({ data: donnees }),
  ])

  revalidatePath('/statistiques')
  return { success: true, saison, nb: donnees.length, remplaces: supprimes.count, erreurs: errors }
}
