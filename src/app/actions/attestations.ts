'use server'

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { requireAuth } from '@/lib/session'
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
      await transporterInfo.transporter.sendMail({
        from:    transporterInfo.from,
        to:      email,
        subject: `Attestation de paiement — Saison ${saisonLabel}`,
        text:    body,
        html:    body.replace(/\n/g, '<br>'),
        attachments: [{ filename: fileName, content: Buffer.from(pdfBytes) }],
      })

      console.log(`[attestations] Email envoyé avec succès à ${email}`)
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
