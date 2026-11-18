'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { formatDate } from '@/lib/crypto'
import { PAS_INVITE } from '@/lib/invite'
import { parseBrevets } from '@/lib/parsers/brevets'
import { saisonBrevet, nettoyerNiveau, cleNiveau, ORDRE_FAMILLES } from '@/lib/brevets'
import { calculerDiplomes, type DiplomesData } from '@/lib/diplomes-serveur'

// ── Diplômes (brevets FFESSM) ────────────────────────────────────────────────
// Deux sources dans la même table `brevets` :
//   IMPORT : export FFESSM « Liste des brevets » (licence, sans nom)
//   SAISIE : ajout à la main dans Gestion des diplômes (rattaché à un adhérent)
// Les statistiques comptent les deux.

// Le calcul des stats est dans lib/diplomes-serveur.ts (partagé avec la page
// d'AG en lecture seule) ; ici, uniquement le contrôle d'accès.
export type { DiplomesData, DiplomesSaison } from '@/lib/diplomes-serveur'

export async function getDiplomesData(): Promise<DiplomesData> {
  await requireAuth()
  return calculerDiplomes()
}

/** Licence telle que stockée dans `brevets` (même forme que le parser). */
function normLicence(licence: string | null | undefined): string | null {
  return (licence ?? '').toUpperCase().replace(/\s+/g, '') || null
}

// ── Import FFESSM ────────────────────────────────────────────────────────────

export interface ImportBrevetsResult {
  success:    boolean
  error?:     string
  saison?:    string
  nb?:        number
  remplaces?: number   // brevets importés de la même saison supprimés avant l'import
  saisiesRemplacees?: number   // saisies manuelles retrouvées dans l'import
  erreurs?:   string[]
}

/**
 * Importe un export FFESSM « Liste des brevets ».
 * La saison est lue dans le fichier ; ses brevets IMPORTÉS déjà en base sont
 * REMPLACÉS (réimporter le même fichier ne crée pas de doublons).
 * Les SAISIES manuelles sont conservées, sauf celles que l'import contient
 * déjà (même licence + même libellé) : l'import fait foi, pas de double compte.
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

  // Saisies manuelles de la saison que l'import rend redondantes
  const dansImport = new Set(donnees.filter(b => b.licence).map(b => `${b.licence}|${cleNiveau(b.niveau)}`))
  const saisies = await prisma.brevet.findMany({
    where:  { saison, source: 'SAISIE' },
    select: { id: true, licence: true, niveau: true },
  })
  const redondantes = saisies
    .filter(s => s.licence && dansImport.has(`${s.licence}|${cleNiveau(s.niveau)}`))
    .map(s => s.id)

  // Tout dans une même transaction : en cas d'échec, rien n'a bougé.
  const [supprimes] = await prisma.$transaction([
    prisma.brevet.deleteMany({ where: { saison, source: 'IMPORT' } }),
    prisma.brevet.deleteMany({ where: { id: { in: redondantes } } }),
    prisma.brevet.createMany({ data: donnees }),   // source = IMPORT par défaut
  ])

  revalidatePath('/statistiques')
  revalidatePath('/diplomes')
  return {
    success: true, saison, nb: donnees.length, remplaces: supprimes.count,
    saisiesRemplacees: redondantes.length, erreurs: errors,
  }
}

// ── Saisie manuelle ──────────────────────────────────────────────────────────

export interface AdherentDiplome {
  id:      string
  nom:     string
  prenom:  string
  licence: string | null
}

/**
 * Adhérents ACTIFS de la saison (même règle que les listes : dateExpiration =
 * date d'expiration de la saison), invités exclus — ils ne vont pas dans l'eau.
 */
export async function getAdherentsPourDiplome(saisonId: string): Promise<AdherentDiplome[]> {
  await requireAuth()
  const saison = await prisma.saison.findUnique({
    where:  { id: saisonId },
    select: { dateExpireLicence: true },
  })
  if (!saison) return []
  const expire = saison.dateExpireLicence?.trim()

  return prisma.adherent.findMany({
    where: {
      AND: [
        { saisonId },
        expire ? { dateExpiration: expire } : {},
        PAS_INVITE,
      ],
    },
    select:  { id: true, nom: true, prenom: true, licence: true },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  })
}

export interface AjoutDiplome {
  saisonId:      string
  adherentId:    string
  niveau:        string
  famille:       string   // catégorie (obligatoire)
  dateObtention: string   // AAAA-MM-JJ (champ date du navigateur) ou vide
}

export interface AjoutDiplomeResult {
  success:  boolean
  error?:   string
  message?: string
}

export async function ajouterDiplome(saisie: AjoutDiplome): Promise<AjoutDiplomeResult> {
  try {
    await requireAuth()
  } catch {
    return { success: false, error: 'Non authentifié' }
  }

  const niveau = nettoyerNiveau(saisie.niveau ?? '')
  if (!niveau) return { success: false, error: 'Saisissez le nom du diplôme.' }
  if (niveau.length > 200) return { success: false, error: 'Nom du diplôme trop long (200 caractères maximum).' }

  const familleSaisie = nettoyerNiveau(saisie.famille ?? '')
  if (!familleSaisie) return { success: false, error: 'Choisissez ou saisissez une catégorie.' }
  if (familleSaisie.length > 60) return { success: false, error: 'Catégorie trop longue (60 caractères maximum).' }
  // Catégorie existante à la casse / aux accents près → orthographe connue,
  // pour ne pas créer deux colonnes « Pêche sous-marine » dans les stats.
  const connues = [
    ...ORDRE_FAMILLES,
    ...(await prisma.brevet.findMany({
      where: { famille: { not: null } }, distinct: ['famille'], select: { famille: true },
    })).map(b => b.famille as string),
  ]
  const famille = connues.find(f => cleNiveau(f) === cleNiveau(familleSaisie)) ?? familleSaisie

  let dateObtention: string | null = null
  if (saisie.dateObtention) {
    dateObtention = formatDate(saisie.dateObtention)
    if (!dateObtention) return { success: false, error: 'Date d\'obtention invalide.' }
  }

  const saisonBd = await prisma.saison.findUnique({ where: { id: saisie.saisonId }, select: { label: true } })
  const saison = saisonBd ? saisonBrevet(saisonBd.label) : null
  if (!saison) return { success: false, error: 'Saison introuvable.' }

  // L'adhérent doit appartenir à la saison choisie (et ne pas être invité)
  const adherent = await prisma.adherent.findFirst({
    where:  { AND: [{ id: saisie.adherentId, saisonId: saisie.saisonId }, PAS_INVITE] },
    select: { id: true, nom: true, prenom: true, licence: true },
  })
  if (!adherent) return { success: false, error: 'Adhérent introuvable dans cette saison.' }
  const licence = normLicence(adherent.licence)

  // Doublon : même diplôme déjà saisi pour cette fiche, ou déjà présent
  // (import ou saisie) pour la même licence dans la saison.
  const existants = await prisma.brevet.findMany({
    where: {
      saison,
      OR: [{ adherentId: adherent.id }, ...(licence ? [{ licence }] : [])],
    },
    select: { niveau: true, source: true },
  })
  const doublon = existants.find(b => cleNiveau(b.niveau) === cleNiveau(niveau))
  if (doublon) {
    return {
      success: false,
      error: `« ${doublon.niveau} » est déjà enregistré pour ${adherent.prenom} ${adherent.nom} en ${saison}`
        + (doublon.source === 'IMPORT' ? ' (export FFESSM).' : '.'),
    }
  }

  await prisma.brevet.create({
    data: { saison, niveau, famille, dateObtention, licence, source: 'SAISIE', adherentId: adherent.id },
  })

  revalidatePath('/statistiques')
  revalidatePath('/diplomes')
  return {
    success: true,
    message: `Diplôme « ${niveau} » (${famille}) ajouté à ${adherent.prenom} ${adherent.nom} (saison ${saison}).`,
  }
}
