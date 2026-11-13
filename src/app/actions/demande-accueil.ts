'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getSmtpTransporter } from '@/app/actions/smtp-config'
import { genererPdfDemande } from '@/lib/pdf-demande-accueil'
import { expediteur, SaisieDemande } from '@/lib/demande-accueil'
import { ErreurSaisie, memoriserTelephone, preparerDemande } from '@/lib/demande-accueil-serveur'

// ── Envoi d'une demande d'accueil piscine ────────────────────────────────────
// Spec : docs/SPEC-demande-accueil.md § 7.
// Séquence : demande créée en BROUILLON → envoi du mail → ENVOYEE ou ERREUR.
// Droits : tout utilisateur connecté (restriction éventuelle non décidée).

export interface ResultatEnvoi {
  ok:     boolean
  error?: string
  /** Résumé pour l'affichage après succès */
  a?:  string[]
  cc?: string[]
}

export async function envoyerDemande(saisie: SaisieDemande): Promise<ResultatEnvoi> {
  let user
  try {
    user = await requireAuth()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // 1. Préparation (mêmes calculs que l'aperçu) + SMTP + PDF, avant toute écriture
  let prep, smtp, pdf
  try {
    const config = await prisma.userSmtpConfig.findUnique({ where: { userId: user.id }, select: { isVerified: true } })
    if (!config?.isVerified) {
      return { ok: false, error: "Votre configuration SMTP n'est pas validée (Config → Configuration SMTP → Tester)." }
    }
    prep = await preparerDemande(user, saisie, true)
    smtp = await getSmtpTransporter(user.id)
    pdf  = await genererPdfDemande(prep.modele.pdf, prep.valeurs, prep.modele.champs)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!(e instanceof ErreurSaisie)) console.error('[demande-accueil] Préparation :', message)
    return { ok: false, error: message }
  }

  // 2. Trace en base avant l'envoi (statut BROUILLON)
  const demande = await prisma.demandeAccueil.create({
    data: {
      saisonId:      prep.saisonId,
      typeDemandeId: prep.typeDemandeId,
      modeleId:      prep.modele.id,
      creeParId:     user.id,
      dateSouhaitee: prep.dateSouhaitee,
      heureDebut:    saisie.heureDebut.trim(),
      heureFin:      saisie.heureFin.trim(),
      nbAdultes:     saisie.nbAdultes,
      nbEnfants:     saisie.nbEnfants,
      destinataires: prep.a,
      cc:            prep.cc,
      statut:        'BROUILLON',
      responsables:  { create: prep.responsables },
    },
    select: { id: true },
  })

  // 3. Envoi
  try {
    const info = await smtp.transporter.sendMail({
      from:    expediteur(smtp.from, prep.valeurs.demandeur_nom),
      to:      prep.a,
      cc:      prep.cc,
      replyTo: user.email,
      subject: prep.objet,
      text:    prep.corps,
      attachments: [{ filename: prep.nomFichier, content: Buffer.from(pdf), contentType: 'application/pdf' }],
    })
    // « Envoyé » = accepté par le serveur SMTP de l'utilisateur
    if (info.rejected?.length) {
      throw new Error(`Adresse(s) rejetée(s) par le serveur SMTP : ${info.rejected.join(', ')}`)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[demande-accueil] Envoi :', message)
    await prisma.demandeAccueil.update({
      where: { id: demande.id },
      data:  { statut: 'ERREUR', erreur: message },
    })
    return { ok: false, error: `Échec de l'envoi : ${message}` }
  }

  // 4. Succès : statut, PDF exact envoyé, sélection des destinataires, téléphones
  await prisma.demandeAccueil.update({
    where: { id: demande.id },
    data:  { statut: 'ENVOYEE', envoyeeLe: new Date(), pdf: Buffer.from(pdf), erreur: null },
  })
  try {
    const coches = saisie.destinataireIds
    await prisma.$transaction([
      prisma.destinataireDemande.updateMany({ where: { actif: true, id: { in: coches } },    data: { selectionne: true } }),
      prisma.destinataireDemande.updateMany({ where: { actif: true, id: { notIn: coches } }, data: { selectionne: false } }),
    ])
    await memoriserTelephone(prep.president.nom, prep.president.prenom, saisie.presidentTel)
    await memoriserTelephone(user.lastName, user.firstName, saisie.demandeurTel)
  } catch (e) {
    // Le mail est parti : on ne le signale pas comme un échec
    console.error('[demande-accueil] Mémorisation après envoi :', e)
  }

  return { ok: true, a: prep.a, cc: prep.cc }
}
