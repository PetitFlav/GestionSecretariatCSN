'use server'

import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { requireAuth } from '@/lib/session'
import { SMTP_PRESETS, SmtpProvider } from '@/lib/smtp-presets'

export type { SmtpProvider }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SmtpConfigInput {
  provider: SmtpProvider
  host:     string
  port:     number
  secure:   boolean
  user:     string
  password: string
  from:     string
}

export interface SmtpConfigDisplay {
  provider:   SmtpProvider | null
  host:       string | null
  port:       number | null
  secure:     boolean | null
  user:       string | null
  from:       string | null
  isVerified: boolean
  // password NON retourné — jamais exposé côté client
}

// ── Sel par utilisateur pour le chiffrement ────────────────────────────────────
// On préfixe chaque valeur chiffrée avec l'userId pour que même si deux
// utilisateurs ont le même mot de passe, le chiffré sera différent.
// Le déchiffrement vérifie que l'userId correspond → impossibilité de cross-lecture.

function encryptForUser(value: string | null | undefined, userId: string): string | null {
  if (!value) return null
  return encrypt(`${userId}:${value}`)
}

function decryptForUser(enc: string | null | undefined, userId: string): string | null {
  const raw = decrypt(enc)
  if (!raw) return null
  // Vérifier que le préfixe userId correspond
  if (!raw.startsWith(`${userId}:`)) return null
  return raw.slice(userId.length + 1)
}

// ── Sauvegarder la config SMTP ────────────────────────────────────────────────

export async function saveSmtpConfig(
  input: SmtpConfigInput
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth()

  try {
    const data = {
      provider:    input.provider,
      hostEnc:     encryptForUser(input.host,             user.id),
      portEnc:     encryptForUser(String(input.port),      user.id),
      secureEnc:   encryptForUser(String(input.secure),    user.id),
      userEnc:     encryptForUser(input.user,              user.id),
      passwordEnc: encryptForUser(input.password,          user.id),
      fromEnc:     encryptForUser(input.from,              user.id),
      isVerified:  false, // reset à chaque modification
    }

    await prisma.userSmtpConfig.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ── Charger la config SMTP (sans mot de passe) ────────────────────────────────

export async function loadSmtpConfig(): Promise<SmtpConfigDisplay | null> {
  const user = await requireAuth()

  const config = await prisma.userSmtpConfig.findUnique({
    where: { userId: user.id },
  })

  if (!config) return null

  return {
    provider:   (config.provider as SmtpProvider) ?? null,
    host:       decryptForUser(config.hostEnc,   user.id),
    port:       config.portEnc
      ? parseInt(decryptForUser(config.portEnc, user.id) ?? '587')
      : null,
    secure:     config.secureEnc
      ? decryptForUser(config.secureEnc, user.id) === 'true'
      : null,
    user:       decryptForUser(config.userEnc,   user.id),
    from:       decryptForUser(config.fromEnc,   user.id),
    isVerified: config.isVerified,
  }
}

// ── Tester la connexion SMTP ──────────────────────────────────────────────────

export async function testSmtpConfig(): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth()

  const config = await prisma.userSmtpConfig.findUnique({
    where: { userId: user.id },
  })

  if (!config) return { success: false, error: 'Aucune configuration SMTP enregistrée' }

  const host     = decryptForUser(config.hostEnc,     user.id)
  const portStr  = decryptForUser(config.portEnc,     user.id)
  const secureStr= decryptForUser(config.secureEnc,   user.id)
  const smtpUser = decryptForUser(config.userEnc,     user.id)
  const password = decryptForUser(config.passwordEnc, user.id)
  const from     = decryptForUser(config.fromEnc,     user.id)

  if (!host || !smtpUser || !password || !from) {
    return { success: false, error: 'Configuration incomplète' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port:   parseInt(portStr ?? '587'),
      secure: secureStr === 'true',
      auth:   { user: smtpUser, pass: password },
    })

    // Vérifier la connexion
    await transporter.verify()

    // Envoyer un email de test à l'utilisateur lui-même
    await transporter.sendMail({
      from,
      to:      user.email,
      subject: 'Test SMTP — Gestion Secrétariat CSN',
      text:    'Votre configuration SMTP fonctionne correctement.',
    })

    // Marquer comme vérifié
    await prisma.userSmtpConfig.update({
      where: { userId: user.id },
      data:  { isVerified: true },
    })

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ── Obtenir le transporteur pour l'envoi (usage interne) ──────────────────────

export async function getSmtpTransporter(userId: string) {
  const config = await prisma.userSmtpConfig.findUnique({
    where: { userId },
  })

  if (!config) throw new Error('Aucune configuration SMTP pour cet utilisateur')

  const host     = decryptForUser(config.hostEnc,     userId)
  const portStr  = decryptForUser(config.portEnc,     userId)
  const secureStr= decryptForUser(config.secureEnc,   userId)
  const smtpUser = decryptForUser(config.userEnc,     userId)
  const password = decryptForUser(config.passwordEnc, userId)
  const from     = decryptForUser(config.fromEnc,     userId)

  if (!host || !smtpUser || !password || !from) {
    throw new Error('Configuration SMTP incomplète')
  }

  const transporter = nodemailer.createTransport({
    host,
    port:   parseInt(portStr ?? '587'),
    secure: secureStr === 'true',
    auth:   { user: smtpUser, pass: password },
  })

  return { transporter, from }
}
