import { Resend } from 'resend'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY manquante dans les variables d\'environnement')
  return new Resend(key)
}

export interface SendAttestationParams {
  to:          string
  prenom:      string
  nom:         string
  saison:      string
  pdfBytes:    Uint8Array
  bodyTemplate?: string  // template configurable, avec {prenom} {nom} {saison}
}

export async function sendAttestationEmail(params: SendAttestationParams): Promise<void> {
  const resend = getResend()

  const defaultBody = `Bonjour {prenom},\n\nVeuillez trouver ci-joint votre attestation de paiement pour la saison {saison}.\n\nCordialement,\nLe secrétariat du Centre Subaquatique Nantais`

  const template = params.bodyTemplate || defaultBody
  const body = template
    .replace(/{prenom}/g, params.prenom)
    .replace(/{nom}/g,    params.nom)
    .replace(/{saison}/g, params.saison)

  const fileName = `attestation-${params.nom.toLowerCase().replace(/\s+/g, '-')}-${params.saison.replace('/', '-')}.pdf`

  await resend.emails.send({
    from:    process.env.SMTP_FROM || 'secretariat@csn.fr',
    to:      params.to,
    subject: `Attestation de paiement — Saison ${params.saison}`,
    text:    body,
    html:    body.replace(/\n/g, '<br>'),
    attachments: [
      {
        filename: fileName,
        content:  Buffer.from(params.pdfBytes),
      },
    ],
  })
}

/**
 * Vérifie si Resend est configuré
 */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}
