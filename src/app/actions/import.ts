'use server'

import { prisma } from '@/lib/db'
import { encrypt, decrypt, keysMatch } from '@/lib/crypto'
import { parseMembres } from '@/lib/parsers/membres'
import { parsePaiements } from '@/lib/parsers/paiements'
import { parseFFESSM, adressesDifferentes } from '@/lib/parsers/ffessm'
import { requireAuth } from '@/lib/session'

export interface ImportResult {
  success: boolean
  error?: string
  stats?: {
    crees:        number
    misAJour:     number
    ignores:      number
    desyncsFFESSM: number
    erreurs:      string[]
  }
}

export async function importerFichiers(formData: FormData): Promise<ImportResult> {
  try {
    await requireAuth()
  } catch {
    return { success: false, error: 'Non authentifié' }
  }

  const saisonId     = formData.get('saisonId') as string
  const membreFile   = formData.get('membres') as File | null
  const paiementFile = formData.get('paiements') as File | null
  const ffessmFile   = formData.get('ffessm') as File | null

  if (!saisonId)     return { success: false, error: 'Saison non sélectionnée' }
  if (!membreFile)   return { success: false, error: 'Fichier Membres obligatoire' }
  if (!paiementFile) return { success: false, error: 'Fichier Paiements obligatoire' }

  // Charger la saison
  const saison = await prisma.saison.findUnique({ where: { id: saisonId } })
  if (!saison) return { success: false, error: 'Saison introuvable' }

  const allErrors: string[] = []
  let crees = 0, misAJour = 0, ignores = 0, desyncsFFESSM = 0

  // ── 1. Parser les fichiers ────────────────────────────────────────────────

  const membreBuffer   = await membreFile.arrayBuffer()
  const paiementBuffer = await paiementFile.arrayBuffer()

  const { membres, errors: membresErrors } = parseMembres(membreBuffer)
  allErrors.push(...membresErrors)

  const { paiements, errors: paiementsErrors } = parsePaiements(paiementBuffer, saison.label)
  allErrors.push(...paiementsErrors)

  let ffessmMap = new Map()
  if (ffessmFile) {
    const ffessmBuffer = await ffessmFile.arrayBuffer()
    const { ffessm, errors: ffessmErrors } = parseFFESSM(ffessmBuffer)
    ffessmMap = ffessm
    allErrors.push(...ffessmErrors)
  }

  if (membres.length === 0) {
    return { success: false, error: 'Aucun membre trouvé dans le fichier Membres' }
  }

  // ── 2. Traiter chaque membre ──────────────────────────────────────────────

  for (const membre of membres) {
    try {
      // Jointure avec paiements — teste toutes les variantes tiret/espace
      let paiement = paiements.get(membre.key)
      if (!paiement) {
        for (const [k, v] of paiements.entries()) {
          if (keysMatch(membre.key, k)) { paiement = v; break }
        }
      }

      // Jointure avec FFESSM — idem
      let ffessm = ffessmMap.get(membre.key)
      if (!ffessm) {
        for (const [k, v] of ffessmMap.entries()) {
          if (keysMatch(membre.key, k)) { ffessm = v; break }
        }
      }

      // Détecter désynchronisation adresse
      let adresseDesync = false
      if (ffessm) {
        // Déchiffrer l'adresse club pour comparer (si déjà en base)
        // Pour un nouvel import, on compare directement les valeurs parsées
        adresseDesync = adressesDifferentes(
          { adresse: membre.adresse, cp: membre.codePostal, ville: membre.ville },
          { adresse: ffessm.adresse, cp: ffessm.codePostal, ville: ffessm.ville }
        )
        if (adresseDesync) desyncsFFESSM++
      }

      // Chiffrer les données sensibles
      const emailEnc         = encrypt(membre.email)
      const dateNaissanceEnc = encrypt(membre.dateNaissance)
      const adresseEnc       = encrypt(membre.adresse)
      const codePostalEnc    = encrypt(membre.codePostal)
      const villeEnc         = encrypt(membre.ville)

      // Montant et dates paiement
      const montant      = paiement
        ? `${paiement.montantTotal.toFixed(2)} €`
        : null
      const datePaiement = paiement?.datesPaiement.length
        ? paiement.datesPaiement.join(' / ')
        : null

      // Upsert adhérent (unique sur saisonId + nom + prenom)
      const existing = await prisma.adherent.findFirst({
        where: { saisonId, nom: membre.nom, prenom: membre.prenom },
      })

      const data = {
        saisonId,
        nom:             membre.nom,
        prenom:          membre.prenom,
        civilite:        membre.civilite,
        licence:         membre.licence,
        dateExpiration:  membre.dateExpiration,
        caci:            membre.caci,
        montant,
        datePaiement,
        emailEnc,
        dateNaissanceEnc,
        adresseEnc,
        codePostalEnc,
        villeEnc,
        ffessmId:        ffessm?.ffessmId ?? null,
        adresseDesync,
      }

      let adherentId: string
      if (existing) {
        await prisma.adherent.update({ where: { id: existing.id }, data })
        adherentId = existing.id
        misAJour++
      } else {
        const created = await prisma.adherent.create({ data })
        adherentId = created.id
        crees++
      }

      // Stocker l'adresse FFESSM chiffrée dans ValidationFFESSM
      if (ffessm?.ffessmId) {
        await prisma.validationFFESSM.upsert({
          where:  { adherentId },
          create: {
            adherentId,
            saisonId,
            adresseEnc:    encrypt(ffessm.adresse),
            codePostalEnc: encrypt(ffessm.codePostal),
            villeEnc:      encrypt(ffessm.ville),
          },
          update: {
            adresseEnc:    encrypt(ffessm.adresse),
            codePostalEnc: encrypt(ffessm.codePostal),
            villeEnc:      encrypt(ffessm.ville),
          },
        })
      }
    } catch (err) {
      ignores++
      allErrors.push(`Erreur sur ${membre.prenom} ${membre.nom} : ${String(err)}`)
    }
  }

  return {
    success: true,
    stats: {
      crees,
      misAJour,
      ignores,
      desyncsFFESSM,
      erreurs: allErrors,
    },
  }
}

// ── Récupérer les saisons disponibles ────────────────────────────────────────

export async function getSaisons() {
  return prisma.saison.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

// ── Créer une saison ─────────────────────────────────────────────────────────

export interface SaisonInput {
  label:            string
  dateDebut:        string
  dateFin:          string
  dateExpireLicence: string
}

export async function creerSaison(data: SaisonInput): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth()

    // Désactiver toutes les autres saisons
    await prisma.saison.updateMany({ data: { isActive: false } })

    await prisma.saison.create({
      data: { ...data, isActive: true },
    })

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unique constraint')) {
      return { success: false, error: `La saison "${data.label}" existe déjà` }
    }
    return { success: false, error: message }
  }
}

export async function activerSaison(id: string): Promise<{ success: boolean }> {
  await requireAuth()
  await prisma.saison.updateMany({ data: { isActive: false } })
  await prisma.saison.update({ where: { id }, data: { isActive: true } })
  return { success: true }
}
