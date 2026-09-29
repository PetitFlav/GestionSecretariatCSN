/**
 * src/lib/system-mail.ts
 *
 * SMTP « club » pour les emails système (invitations, réinitialisation de mot
 * de passe, notifications admin). Configuré par variables d'environnement,
 * indépendant du SMTP personnel des utilisateurs (qui reste utilisé pour les
 * attestations et rappels CACI).
 *
 * ⚠️ Pas de 'use server' ici : ce module ne doit PAS être exposé en server action.
 */

import nodemailer from 'nodemailer'

export function isSystemMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

let cached: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!isSystemMailConfigured()) {
    throw new Error('SMTP système non configuré (SMTP_HOST / SMTP_USER / SMTP_PASS)')
  }
  if (!cached) {
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
    cached = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port,
      // 465 = SSL implicite ; 587 = STARTTLS. SMTP_SECURE permet de forcer.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return cached
}

export type SystemMailResult = { sent: true } | { sent: false; reason: string }

export async function sendSystemMail(opts: {
  to: string | string[]
  subject: string
  html: string
  text?: string
}): Promise<SystemMailResult> {
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER!
    const info = await getTransporter().sendMail({ from, ...opts })
    if (info.rejected?.length) {
      return { sent: false, reason: `Adresse(s) rejetée(s) : ${info.rejected.join(', ')}` }
    }
    return { sent: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[system-mail] échec :', reason)
    return { sent: false, reason }
  }
}

export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) console.warn('[system-mail] NEXT_PUBLIC_APP_URL non défini → liens en localhost')
  return (url ?? 'http://localhost:3000').replace(/\/$/, '')
}
