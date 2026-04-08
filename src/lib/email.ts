import { getSmtpTransporter } from '@/app/actions/smtp-config'

/**
 * Envoie le lien de création de mot de passe au nouvel utilisateur
 * via le SMTP de l'admin qui approuve (userId).
 * Fallback : log dans la console si pas de SMTP configuré.
 */
export async function sendSetupEmail(
  email: string,
  token: string,
  adminUserId: string
) {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const setupUrl = `${appUrl}/auth/setup-password?token=${token}`

  try {
    const { transporter, from } = await getSmtpTransporter(adminUserId)

    await transporter.sendMail({
      from,
      to:      email,
      subject: 'Gestion Secrétariat CSN — Créez votre mot de passe',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a3a5c;">Votre accès a été approuvé</h2>
          <p>Votre demande d'accès à l'application <strong>Gestion Secrétariat CSN</strong> a été validée.</p>
          <p>Cliquez sur le bouton ci-dessous pour créer votre mot de passe :</p>
          <a href="${setupUrl}"
             style="display:inline-block; padding: 12px 24px; background: #1a3a5c;
                    color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Créer mon mot de passe
          </a>
          <p style="color: #666; font-size: 13px;">
            Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Centre Subaquatique Nantais — FFESSM N° 03-44-0034</p>
        </div>
      `,
    })
  } catch {
    // Pas de SMTP configuré pour cet admin → log le lien dans la console
    console.log('\n─── SMTP non configuré — lien de création de mot de passe :')
    console.log(setupUrl)
    console.log('────────────────────────────────────────────────────────────\n')
  }
}

/**
 * Notifie l'admin qu'une nouvelle demande d'accès est en attente.
 * Via le SMTP de l'admin si configuré, sinon silencieux.
 */
export async function sendApprovalNotificationEmail(
  email: string,
  adminUserId?: string
) {
  if (!adminUserId) return

  try {
    const { transporter, from } = await getSmtpTransporter(adminUserId)
    await transporter.sendMail({
      from,
      to:      from, // notif interne → à l'admin lui-même
      subject: `Nouvelle demande d'accès — ${email}`,
      html: `
        <p>Une nouvelle demande d'accès a été soumise par <strong>${email}</strong>.</p>
        <p>Connectez-vous à l'application pour valider ou refuser cette demande.</p>
      `,
    })
  } catch {
    // Silencieux si pas de SMTP configuré
  }
}
