'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { getSession, getSessionUser } from '@/lib/session'
import { sendSetupEmail, sendApprovalNotificationEmail } from '@/lib/email'
import {
  registerSchema,
  loginSchema,
  setupPasswordSchema,
} from '@/lib/validations'

type ActionResult = {
  error?: string
  success?: string
}

// ─── Demande d'accès ──────────────────────────────────────────────────────────

export async function registerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { email } = parsed.data

  try {
    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
      if (existing.status === 'ACTIVE') {
        return { error: 'Un compte existe déjà avec cet email. Connectez-vous.' }
      }
      if (existing.status === 'PENDING') {
        return { success: 'Votre demande est déjà en cours de traitement.' }
      }
      if (existing.status === 'DISABLED') {
        return { error: 'Ce compte a été désactivé. Contactez un administrateur.' }
      }
    }

    await prisma.user.create({
      data: { email, status: 'PENDING', role: 'USER' },
    })

    // Notif interne (si SMTP configuré)
    await sendApprovalNotificationEmail(email).catch(console.error)

    return { success: 'ok' }
  } catch (err) {
    console.error('registerAction:', err)
    return { error: 'Une erreur est survenue. Réessayez.' }
  }
}

// ─── Connexion ────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { email, password } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return { error: 'Email ou mot de passe incorrect.' }
    }

    if (user.status === 'PENDING') {
      return { error: 'Votre compte est en attente de validation par un administrateur.' }
    }

    if (user.status === 'DISABLED') {
      return { error: 'Ce compte a été désactivé. Contactez un administrateur.' }
    }

    if (!user.passwordHash) {
      return { error: 'Compte non initialisé. Vérifiez votre email pour créer votre mot de passe.' }
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return { error: 'Email ou mot de passe incorrect.' }
    }

    const session = await getSession()
    session.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    }
    await session.save()
  } catch (err) {
    console.error('loginAction:', err)
    return { error: 'Une erreur est survenue. Réessayez.' }
  }

  redirect('/')
}

// ─── Déconnexion ──────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}

// ─── Création du mot de passe (via token email) ───────────────────────────────

export async function setupPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = setupPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { token, password } = parsed.data

  try {
    const user = await prisma.user.findFirst({
      where: {
        setupToken: token,
        setupTokenExpiry: { gt: new Date() },
        status: 'ACTIVE',
      },
    })

    if (!user) {
      return { error: 'Lien invalide ou expiré. Contactez un administrateur.' }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        setupToken: null,
        setupTokenExpiry: null,
      },
    })

    // Connexion automatique après création du mot de passe
    const session = await getSession()
    session.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    }
    await session.save()
  } catch (err) {
    console.error('setupPasswordAction:', err)
    return { error: 'Une erreur est survenue. Réessayez.' }
  }

  redirect('/')
}

// ─── Approbation d'un utilisateur (admin) ────────────────────────────────────

export async function approveUserAction(
  userId: string,
  role: 'USER' | 'ADMIN' | 'SUPERUSER'
): Promise<ActionResult> {
  const currentUser = await getSessionUser()
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERUSER')) {
    return { error: 'Accès refusé.' }
  }

  try {
    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        role,
        setupToken: token,
        setupTokenExpiry: expiry,
      },
    })

    await sendSetupEmail(user.email, token, currentUser.id)

    return { success: `Compte approuvé — email envoyé à ${user.email}` }
  } catch (err) {
    console.error('approveUserAction:', err)
    return { error: 'Une erreur est survenue.' }
  }
}

// ─── Désactivation d'un utilisateur (admin) ──────────────────────────────────

export async function disableUserAction(userId: string): Promise<ActionResult> {
  const currentUser = await getSessionUser()
  if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERUSER')) {
    return { error: 'Accès refusé.' }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'DISABLED' },
    })
    return { success: 'Compte désactivé.' }
  } catch (err) {
    console.error('disableUserAction:', err)
    return { error: 'Une erreur est survenue.' }
  }
}
