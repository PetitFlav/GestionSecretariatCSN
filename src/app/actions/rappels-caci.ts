'use server'

import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { requireAuth } from '@/lib/session'
import { getSmtpTransporter } from '@/app/actions/smtp-config'

export interface RappelResult {
  success:  boolean
  envoyes:  number
  erreurs:  { nom: string; prenom: string; raison: string }[]
}

export async function envoyerRappelsCaci(
  adherentIds: string[],
  saisonId:    string,
  type:        'expire' | 'bientot'
): Promise<RappelResult> {
  const user = await requireAuth()

  // Vérifier SMTP
  let transporterInfo: Awaited<ReturnType<typeof getSmtpTransporter>>
  try {
    transporterInfo = await getSmtpTransporter(user.id)
  } catch {
    return {
      success: false,
      envoyes: 0,
      erreurs: [{ nom: '', prenom: '', raison: 'Aucun compte email configuré. Allez dans Config → Mon compte email.' }],
    }
  }

  const erreurs: RappelResult['erreurs'] = []
  let envoyes = 0

  for (const adherentId of adherentIds) {
    const adherent = await prisma.adherent.findUnique({ where: { id: adherentId } })
    if (!adherent) {
      erreurs.push({ nom: '?', prenom: '?', raison: 'Adhérent introuvable' })
      continue
    }

    const email = decrypt(adherent.emailEnc)
    if (!email) {
      erreurs.push({ nom: adherent.nom, prenom: adherent.prenom, raison: 'Email manquant' })
      continue
    }

    const caci = adherent.caci ?? 'date inconnue'

    // Message selon le type
    const message = type === 'expire'
      ? `Bonjour ${adherent.prenom},\n\nVeuillez mettre à jour votre Certificat médical de contre-indication (CACI) sur VPdive qui vient d'expirer au ${caci}, s'il vous plaît.\n\nCordialement,\nLe secrétariat du Centre Subaquatique Nantais`
      : `Bonjour ${adherent.prenom},\n\nVotre Certificat médical de contre-indication (CACI) sur VPdive va bientôt expirer le ${caci}. Pensez à le mettre à jour, s'il vous plaît.\n\nCordialement,\nLe secrétariat du Centre Subaquatique Nantais`

    const subject = type === 'expire'
      ? 'CACI expiré — Mise à jour requise'
      : `CACI bientôt expiré — Rappel`

    try {
      await transporterInfo.transporter.sendMail({
        from:    transporterInfo.from,
        to:      email,
        subject,
        text:    message,
        html:    `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="border-bottom: 1px solid #ddeaf6; padding-bottom: 12px; margin-bottom: 24px;">
              <strong style="color: #1a3a5c; font-size: 15px;">CENTRE SUBAQUATIQUE NANTAIS</strong><br>
              <span style="color: #888; font-size: 12px;">F.F.E.S.S.M. N° 03-44-0034 — 3 Rue Conan Mériadec, 44200 NANTES</span>
            </div>
            <p style="color: #333;">${message.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">Secrétariat du Centre Subaquatique Nantais</p>
          </div>
        `,
      })

      // Enregistrer le rappel en base
      await prisma.rappelCaci.create({
        data: { adherentId, saisonId, email },
      })

      envoyes++
    } catch (err) {
      erreurs.push({
        nom:    adherent.nom,
        prenom: adherent.prenom,
        raison: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { success: erreurs.length === 0, envoyes, erreurs }
}

// ── Récupérer le nombre de rappels envoyés par adhérent ──────────────────────

export async function getRappelsCaciCount(
  saisonId: string
): Promise<Map<string, number>> {
  await requireAuth()

  const rappels = await prisma.rappelCaci.groupBy({
    by: ['adherentId'],
    where: { saisonId },
    _count: { id: true },
  })

  return new Map(rappels.map(r => [r.adherentId, r._count.id]))
}
