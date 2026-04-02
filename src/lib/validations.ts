import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
})

export const loginSchema = z.object({
  email: z.string().email('Email invalide').toLowerCase().trim(),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const setupPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export const updateUserRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['USER', 'ADMIN', 'SUPERUSER']),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SetupPasswordInput = z.infer<typeof setupPasswordSchema>
