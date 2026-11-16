'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { parseBrevets } from '@/lib/parsers/brevets'

// ── Diplômes (brevets FFESSM) pour les statistiques ──────────────────────────

export interface DiplomesSaison {
  saison:    string   // « 2025-2026 »
  total:     number
  importeLe: string   // JJ/MM/AAAA
}

export interface DiplomesData {
  saisons: DiplomesSaison[]                                   // plus récente d'abord
  lignes:  { saison: string; niveau: string; count: number }[] // niveau = libellé FFESSM brut
}

function dateFr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Comptages par (saison, niveau). Aucune licence ne quitte le serveur. */
export async function getDiplomesData(): Promise<DiplomesData> {
  await requireAuth()

  const brevets = await prisma.brevet.findMany({
    select: { saison: true, niveau: true, createdAt: true },
  })

  // Agrégation en mémoire (pas de groupBy Prisma — cf. soucis de build Vercel)
  const compteurs = new Map<string, { saison: string; niveau: string; count: number }>()
  const parSaison = new Map<string, { total: number; importe: Date }>()
  for (const b of brevets) {
    const k = `${b.saison}|${b.niveau}`
    const l = compteurs.get(k)
    if (l) l.count++
    else compteurs.set(k, { saison: b.saison, niveau: b.niveau, count: 1 })

    const s = parSaison.get(b.saison)
    if (s) { s.total++; if (b.createdAt > s.importe) s.importe = b.createdAt }
    else parSaison.set(b.saison, { total: 1, importe: b.createdAt })
  }

  return {
    saisons: Array.from(parSaison.entries())
      .map(([saison, s]) => ({ saison, total: s.total, importeLe: dateFr(s.importe) }))
      .sort((a, b) => b.saison.localeCompare(a.saison)),   // « AAAA-AAAA » : tri texte = tri chronologique
    lignes: Array.from(compteurs.values()),
  }
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
