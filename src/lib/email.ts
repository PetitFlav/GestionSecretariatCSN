/**
 * src/lib/email.ts
 *
 * Emails système liés aux comptes utilisateurs.
 * Envoi via le SMTP club (variables d'env, cf. system-mail.ts).
 * Fallback pour les invitations : SMTP perso de l'admin qui approuve,
 * si le SMTP club n'est pas configuré.
 */

import { prisma } from '@/lib/db'
import { getSmtpTransporter } from '@/app/actions/smtp-config'
import { sendSystemMail, isSystemMailConfigured, appUrl } from '@/lib/system-mail'

const FOOTER = `
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Centre Subaquatique Nantais — FFESSM N° 03-44-0034</p>`

function button(href: string, label: string) {
  return `<a href="${href}"
     style="display:inline-block; padding: 12px 24px; background: #1a3a5c;
            color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
    ${label}
  </a>`
}

export type SendLinkResult =
  | { sent: true }
  | { sent: false; reason: string; link: string }

// ── Invitation : création du mot de passe ─────────────────────────────────────

export async function sendSetupEmail(
  email: string,
  token: string,
  adminUserId: string
): Promise<SendLinkResult> {
  const link = `${appUrl()}/auth/setup-password?token=${token}`
  const subject = 'Gestion Secrétariat CSN — Créez votre mot de passe'
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1a3a5c;">Votre accès a été approuvé</h2>
      <p>Votre demande d'accès à l'application <strong>Gestion Secrétariat CSN</strong> a été validée.</p>
      <p>Cliquez sur le bouton ci-dessous pour créer votre mot de passe :</p>
      ${button(link, 'Créer mon mot de passe')}
      <p style="color: #666; font-size: 13px;">
        Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
      </p>
      ${FOOTER}
    </div>`
  const text = `Votre accès à Gestion Secrétariat CSN a été validé.\nCréez votre mot de passe (lien valable 48 h) :\n${link}`

  // 1. SMTP club
  if (isSystemMailConfigured()) {
    const res = await sendSystemMail({ to: email, subject, html, text })
    return res.sent ? res : { ...res, link }
  }

  // 2. Fallback : SMTP perso de l'admin
  try {
    const { transporter, from } = await getSmtpTransporter(adminUserId)
    const info = await transporter.sendMail({ from, to: email, subject, html, text })
    if (info.rejected?.length) {
      return { sent: false, reason: 'Adresse rejetée par le serveur SMTP', link }
    }
    return { sent: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[setup-email] échec pour', email, '→', reason)
    return { sent: false, reason, link }
  }
}

// ── Mot de passe oublié ───────────────────────────────────────────────────────

export async function sendResetPasswordEmail(
  email: string,
  token: string
): Promise<SendLinkResult> {
  const link = `${appUrl()}/auth/reset-password?token=${token}`
  const res = await sendSystemMail({
    to: email,
    subject: 'Gestion Secrétariat CSN — Réinitialisation du mot de passe',
    text: `Pour choisir un nouveau mot de passe (lien valable 1 h) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a3a5c;">Réinitialisation du mot de passe</h2>
        <p>Une demande de réinitialisation a été faite pour votre compte
           <strong>Gestion Secrétariat CSN</strong>.</p>
        ${button(link, 'Choisir un nouveau mot de passe')}
        <p style="color: #666; font-size: 13px;">
          Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande,
          ignorez cet email : votre mot de passe actuel reste valable.
        </p>
        ${FOOTER}
      </div>`,
  })
  return res.sent ? res : { ...res, link }
}

// ── Notification admins : nouvelle demande d'accès ────────────────────────────

export async function sendApprovalNotificationEmail(email: string): Promise<void> {
  if (!isSystemMailConfigured()) return

  const admins = await prisma.user.findMany({
    where:  { status: 'ACTIVE', role: { in: ['ADMIN', 'SUPERUSER'] } },
    select: { email: true },
  })
  if (admins.length === 0) return

  await sendSystemMail({
    to: admins.map((a: { email: string }) => a.email),
    subject: `Nouvelle demande d'accès — ${email}`,
    html: `
      <p>Une nouvelle demande d'accès a été soumise par <strong>${email}</strong>.</p>
      <p>${button(`${appUrl()}/admin/users`, 'Traiter la demande')}</p>`,
  })
}
