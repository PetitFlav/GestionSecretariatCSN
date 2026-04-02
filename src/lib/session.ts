import { getIronSession, IronSession, IronSessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { UserRole, UserStatus } from '@prisma/client'

export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  status: UserStatus
}

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser
  }
}

export const sessionOptions: IronSessionOptions = {
  cookieName: 'csn_session',
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
}

export async function getSession(): Promise<IronSession> {
  const session = await getIronSession(await cookies(), sessionOptions)
  return session
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession()
  return session.user ?? null
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('Non authentifié')
  }
  if (user.status !== 'ACTIVE') {
    throw new Error('Compte inactif')
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'ADMIN' && user.role !== 'SUPERUSER') {
    throw new Error('Accès refusé — droits insuffisants')
  }
  return user
}

export async function requireSuperUser(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'SUPERUSER') {
    throw new Error('Accès refusé — droits superuser requis')
  }
  return user
}
