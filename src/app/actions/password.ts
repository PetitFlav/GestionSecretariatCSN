'use server'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { sendResetPasswordEmail } from '@/lib/email'

type ActionResult = { error?: string; success?: string }

const RESET_TTL_MS     = 60 * 60 * 1000  // 1 h
const RESET_COOLDOWN_MS = 2 * 60 * 1000  // 1 demande / 2 min / compte

// Message identique que le compte existe ou non (pas d'énumération d'emails)
const NEUTRAL_MSG =
  'Si un compte actif correspond à cette adresse, un email de réinitialisation vient d’être envoyé. Pensez à vérifier vos spams.'

const forgotSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
})

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    password:        z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })
  .refine(d => d.password !== d.currentPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel',
    path: ['password'],
  })

// ─── Mot de passe oublié (non connecté) ──────────────────────────────────────

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { email } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.status !== 'ACTIVE') return { success: NEUTRAL_MSG }

    // Anti-spam : un lien de reset (TTL 1 h) émis il y a moins de 2 min → on ne renvoie pas.
    // Le test sur la borne haute évite de bloquer à cause d'un token d'invitation (48 h).
    const now = Date.now()
    const exp = user.setupTokenExpiry?.getTime()
    if (exp && exp > now + RESET_TTL_MS - RESET_COOLDOWN_MS && exp <= now + RESET_TTL_MS) {
      return { success: NEUTRAL_MSG }
    }

    const token = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data:  { setupToken: token, setupTokenExpiry: new Date(now + RESET_TTL_MS) },
    })

    const res = await sendResetPasswordEmail(user.email, token)
    if (!res.sent) {
      // On ne révèle rien à l'utilisateur, mais on laisse une trace exploitable côté serveur
      console.error(`[forgot-password] envoi impossible pour ${user.email} : ${res.reason}`)
      return { error: 'L’envoi de l’email a échoué. Réessayez plus tard ou contactez un administrateur.' }
    }

    return { success: NEUTRAL_MSG }
  } catch (err) {
    console.error('forgotPasswordAction:', err)
    return { error: 'Une erreur est survenue. Réessayez.' }
  }
}

// ─── Changement de mot de passe (connecté) ───────────────────────────────────

export async function changePasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  let sessionUser
  try {
    sessionUser = await requireAuth()
  } catch {
    return { error: 'Session expirée. Reconnectez-vous.' }
  }

  const parsed = changeSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password:        formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { currentPassword, password } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } })
    if (!user || user.status !== 'ACTIVE') return { error: 'Compte introuvable ou inactif.' }

    const valid = !!user.passwordHash && (await bcrypt.compare(currentPassword, user.passwordHash))
    if (!valid) return { error: 'Mot de passe actuel incorrect.' }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash:     await bcrypt.hash(password, 12),
        setupToken:       null, // invalide un éventuel lien de reset en cours
        setupTokenExpiry: null,
      },
    })

    return { success: 'Mot de passe modifié.' }
  } catch (err) {
    console.error('changePasswordAction:', err)
    return { error: 'Une erreur est survenue. Réessayez.' }
  }
}
