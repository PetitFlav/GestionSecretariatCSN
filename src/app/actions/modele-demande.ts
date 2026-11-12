'use server'

import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { verifierModeleDemande, CHAMPS_DEMANDE } from '@/lib/pdf-demande-accueil'

// ── Modèle PDF de la demande d'accueil piscine, par saison ───────────────────
// Spec : docs/SPEC-demande-accueil.md § 8 (Gestion des saisons).
// Un seul modèle par saison (ModeleDemande.saisonId est unique) : un nouvel
// upload remplace le précédent. Les demandes déjà envoyées n'en dépendent pas
// pour leur PDF (elles gardent une copie exacte du PDF envoyé).

/** Limite par défaut des server actions de Next (1 Mo), un peu de marge pour l'enveloppe. */
const TAILLE_MAX = 900 * 1024

export interface ResultatModele {
  ok:         boolean
  error?:     string
  /** Date de mise à jour du modèle (ISO), si succès */
  updatedAt?: string
}

/**
 * Enregistre (ou remplace) le modèle PDF d'une saison.
 * Le FormData doit contenir le fichier sous la clé « fichier ».
 * Refuse le fichier s'il manque un des 13 champs attendus.
 */
export async function enregistrerModeleDemande(
  saisonId: string,
  formData: FormData,
): Promise<ResultatModele> {
  try {
    await requireAdmin()

    const fichier = formData.get('fichier')
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { ok: false, error: 'Aucun fichier reçu' }
    }
    if (fichier.size > TAILLE_MAX) {
      return { ok: false, error: `Fichier trop volumineux (${Math.round(fichier.size / 1024)} Ko, maximum 900 Ko)` }
    }

    const saison = await prisma.saison.findUnique({ where: { id: saisonId }, select: { id: true } })
    if (!saison) return { ok: false, error: 'Saison introuvable' }

    const octets = new Uint8Array(await fichier.arrayBuffer())

    // Vérification des 13 champs (le PDF doit aussi être lisible)
    let verif
    try {
      verif = await verifierModeleDemande(octets)
    } catch {
      return { ok: false, error: "Le fichier n'est pas un PDF lisible (ou il est protégé par un mot de passe)" }
    }
    if (!verif.ok) {
      return {
        ok: false,
        error:
          `Ce PDF n'est pas un modèle valide : il manque ${verif.manquants.length} champ(s) ` +
          `(${verif.manquants.join(', ')}). ` +
          `Champs trouvés : ${verif.trouves.length ? verif.trouves.join(', ') : 'aucun'}. ` +
          `Le modèle doit être exporté de LibreOffice avec « Créer un formulaire PDF » ` +
          `et contenir les ${CHAMPS_DEMANDE.length} champs texte attendus.`,
      }
    }

    // Création, ou remplacement du PDF en conservant les réglages de style.
    // Prisma 5 attend un Buffer pour une colonne Bytes.
    const pdf = Buffer.from(octets)
    const modele = await prisma.modeleDemande.upsert({
      where:  { saisonId },
      create: { saisonId, pdf, champs: {} },
      update: { pdf },
      select: { updatedAt: true },
    })
    return { ok: true, updatedAt: modele.updatedAt.toISOString() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
