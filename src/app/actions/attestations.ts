'use server'

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { requireAuth, requireAdmin } from '@/lib/session'
import { generateAttestationPDF } from '@/lib/pdf-attestation'
import { getSmtpTransporter } from '@/app/actions/smtp-config'

export interface SendResult {
  success:  boolean
  envoyes:  number
  erreurs:  { nom: string; prenom: string; raison: string }[]
}

// ── Envoi d'attestations en lot ───────────────────────────────────────────────

export async function envoyerAttestations(
  adherentIds: string[],
  saisonId:    string
): Promise<SendResult> {
  const user = await requireAuth()

  // Vérifier que l'utilisateur a configuré son SMTP
  let transporterInfo: Awaited<ReturnType<typeof getSmtpTransporter>>
  try {
    transporterInfo = await getSmtpTransporter(user.id)
  } catch {
    return {
      success: false,
      envoyes: 0,
      erreurs: [{
        nom: '', prenom: '',
        raison: 'Aucun compte email configuré. Allez dans Config → Mon compte email.',
      }],
    }
  }

  const saison = await prisma.saison.findUnique({ where: { id: saisonId } })
  if (!saison) return { success: false, envoyes: 0, erreurs: [{ nom: '', prenom: '', raison: 'Saison introuvable' }] }

  const saisonLabel = saison.label.replace('-', '/')
  const bodyTemplate = process.env.EMAIL_BODY_TEMPLATE ||
    'Bonjour {prenom},\n\nVeuillez trouver ci-joint votre attestation de paiement pour la saison {saison}.\n\nCordialement,\nLe secrétariat du Centre Subaquatique Nantais'

  const erreurs: SendResult['erreurs'] = []
  let envoyes = 0

  console.log(`[attestations] Envoi pour ${adherentIds.length} adhérent(s), saison ${saisonId}`)

  for (const adherentId of adherentIds) {
    const adherent = await prisma.adherent.findUnique({ where: { id: adherentId } })
    if (!adherent) {
      erreurs.push({ nom: '?', prenom: '?', raison: 'Adhérent introuvable' })
      continue
    }

    const email = decrypt(adherent.emailEnc)
    console.log(`[attestations] ${adherent.nom} ${adherent.prenom} — emailEnc: ${adherent.emailEnc ? 'présent' : 'NULL'} — email déchiffré: ${email ? email : 'NULL'}`)

    if (!email) {
      erreurs.push({ nom: adherent.nom, prenom: adherent.prenom, raison: 'Email manquant ou non déchiffrable' })
      continue
    }

    try {
      // Civilité lisible
      const civMap: Record<string, string> = {
        monsieur: 'M.', madame: 'Mme', mademoiselle: 'Melle',
      }
      const civKey   = (adherent.civilite ?? '').toLowerCase()
      const civilite = Object.entries(civMap).find(([k]) => civKey.includes(k))?.[1] ?? ''
      const montant  = adherent.montant ?? '—'
      const dateJour = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })

      console.log(`[attestations] Génération PDF pour ${adherent.nom}...`)
      // Générer le PDF
      const pdfBytes = await generateAttestationPDF({
        civilite, nom: adherent.nom, prenom: adherent.prenom,
        montant, saison: saisonLabel, dateJour,
      })
      console.log(`[attestations] PDF généré: ${pdfBytes.length} bytes`)

      // Corps de l'email
      const body = bodyTemplate
        .replace(/{prenom}/g, adherent.prenom)
        .replace(/{nom}/g,    adherent.nom)
        .replace(/{saison}/g, saisonLabel)

      const fileName = `attestation-${adherent.nom.toLowerCase().replace(/\s+/g, '-')}-${saisonLabel.replace('/', '-')}.pdf`

      console.log(`[attestations] Envoi email à ${email}...`)
      // Envoyer via SMTP de l'utilisateur
      const info = await transporterInfo.transporter.sendMail({
        from:    transporterInfo.from,
        to:      email,
        subject: `Attestation de paiement — Saison ${saisonLabel}`,
        text:    body,
        html:    body.replace(/\n/g, '<br>'),
        attachments: [{ filename: fileName, content: Buffer.from(pdfBytes) }],
      })

      // « Envoyé » = accepté par TON serveur SMTP, pas « arrivé dans la boîte ».
      // Un refus immédiat du destinataire remonte ici ; le reste (spam, filtre) est invisible.
      if (info.rejected?.length) {
        throw new Error(`Adresse rejetée par le serveur SMTP : ${info.rejected.join(', ')}`)
      }
      console.log(`[attestations] Email accepté par le SMTP pour ${email} — réponse: ${info.response ?? '?'} — messageId: ${info.messageId ?? '?'}`)
      // Enregistrer en base
      await prisma.attestationEmail.create({
        data: { adherentId, saisonId, email },
      })

      envoyes++
    } catch (err) {
      const raison = err instanceof Error ? err.message : String(err)
      console.error(`[attestations] Erreur ${adherent.nom} ${adherent.prenom}:`, raison)
      erreurs.push({ nom: adherent.nom, prenom: adherent.prenom, raison })
    }
  }

  return { success: erreurs.length === 0, envoyes, erreurs }
}

// ── Prévisualisation PDF ──────────────────────────────────────────────────────

export async function previewAttestation(
  adherentId: string,
  saisonId:   string
): Promise<string | null> {
  await requireAuth()

  const [adherent, saison] = await Promise.all([
    prisma.adherent.findUnique({ where: { id: adherentId } }),
    prisma.saison.findUnique({ where: { id: saisonId } }),
  ])
  if (!adherent || !saison) return null

  const civMap: Record<string, string> = {
    monsieur: 'M.', madame: 'Mme', mademoiselle: 'Melle',
  }
  const civKey   = (adherent.civilite ?? '').toLowerCase()
  const civilite = Object.entries(civMap).find(([k]) => civKey.includes(k))?.[1] ?? ''

  const pdfBytes = await generateAttestationPDF({
    civilite,
    nom:     adherent.nom,
    prenom:  adherent.prenom,
    montant: adherent.montant ?? '—',
    saison:  saison.label.replace('-', '/'),
    dateJour: new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }),
  })

  return Buffer.from(pdfBytes).toString('base64')
}

// ── Copie de secours (admin) ──────────────────────────────────────────────────
// Quand un adhérent dit ne rien recevoir : l'admin récupère le PDF pour le
// transmettre par un autre canal (WhatsApp, mail perso, en main propre…).

async function buildAttestationPdf(adherentId: string) {
  const adherent = await prisma.adherent.findUnique({ where: { id: adherentId } })
  if (!adherent) return null
  const saison = await prisma.saison.findUnique({ where: { id: adherent.saisonId } })
  if (!saison) return null

  const civMap: Record<string, string> = {
    monsieur: 'M.', madame: 'Mme', mademoiselle: 'Melle',
  }
  const civKey      = (adherent.civilite ?? '').toLowerCase()
  const civilite    = Object.entries(civMap).find(([k]) => civKey.includes(k))?.[1] ?? ''
  const saisonLabel = saison.label.replace('-', '/')

  const pdfBytes = await generateAttestationPDF({
    civilite,
    nom:     adherent.nom,
    prenom:  adherent.prenom,
    montant: adherent.montant ?? '—',
    saison:  saisonLabel,
    dateJour: new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }),
  })

  const fileName = `attestation-${adherent.nom.toLowerCase().replace(/\s+/g, '-')}-${saisonLabel.replace('/', '-')}.pdf`
  return { adherent, saisonLabel, pdfBytes, fileName }
}

export type CopieResult = { ok: true; message: string } | { ok: false; error: string }

/** Envoie l'attestation d'un adhérent à l'adresse de connexion de l'admin connecté. */
export async function envoyerAttestationAMoi(adherentId: string): Promise<CopieResult> {
  let user
  try { user = await requireAdmin() } catch (e) { return { ok: false, error: (e as Error).message } }

  let smtp: Awaited<ReturnType<typeof getSmtpTransporter>>
  try {
    smtp = await getSmtpTransporter(user.id)
  } catch {
    return { ok: false, error: 'Aucun compte email configuré. Allez dans Config → Mon compte email.' }
  }

  const built = await buildAttestationPdf(adherentId)
  if (!built) return { ok: false, error: 'Adhérent ou saison introuvable' }
  const { adherent, saisonLabel, pdfBytes, fileName } = built

  try {
    const body =
      `Copie de l'attestation de paiement de ${adherent.prenom} ${adherent.nom} (saison ${saisonLabel}),\n` +
      `à transmettre par un autre moyen.`
    const info = await smtp.transporter.sendMail({
      from:    smtp.from,
      to:      user.email,
      subject: `[Copie] Attestation ${adherent.prenom} ${adherent.nom} — Saison ${saisonLabel}`,
      text:    body,
      html:    body.replace(/\n/g, '<br>'),
      attachments: [{ filename: fileName, content: Buffer.from(pdfBytes) }],
    })
    if (info.rejected?.length) {
      return { ok: false, error: `Adresse rejetée : ${info.rejected.join(', ')}` }
    }
    console.log(`[attestations] Copie ${adherent.nom} envoyée à l'admin ${user.email}`)
    // Volontairement PAS enregistré dans attestationEmail : ce n'est pas un envoi à l'adhérent.
    return { ok: true, message: `Envoyée à ${user.email}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Renvoie le PDF en base64 pour téléchargement direct (aucune dépendance SMTP). */
export async function telechargerAttestation(
  adherentId: string
): Promise<{ ok: true; base64: string; fileName: string } | { ok: false; error: string }> {
  try { await requireAdmin() } catch (e) { return { ok: false, error: (e as Error).message } }

  const built = await buildAttestationPdf(adherentId)
  if (!built) return { ok: false, error: 'Adhérent ou saison introuvable' }
  return { ok: true, base64: Buffer.from(built.pdfBytes).toString('base64'), fileName: built.fileName }
}
