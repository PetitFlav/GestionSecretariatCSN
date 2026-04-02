'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, action] = useFormState(loginAction, {})

  return (
    <>
      <h1 className="text-[15px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
        Connexion
      </h1>
      <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
        Accès réservé aux membres habilités du club CSN.
      </p>

      {state?.error && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4 leading-relaxed"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.error}
        </div>
      )}

      <form action={action} className="flex flex-col gap-0">
        <label className="text-[12px] text-slate-500 mb-1.5 block">Adresse email</label>
        <input type="email" name="email" placeholder="prenom.nom@csn.fr"
          autoComplete="email" required
          className="w-full px-3 py-2 text-[14px] rounded-lg mb-4 outline-none transition-all"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
        />

        <label className="text-[12px] text-slate-500 mb-1.5 block">Mot de passe</label>
        <input type="password" name="password" placeholder="••••••••"
          autoComplete="current-password" required
          className="w-full px-3 py-2 text-[14px] rounded-lg mb-5 outline-none transition-all"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
        />

        <button type="submit"
          className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white"
          style={{ background: 'var(--csn-navy)' }}>
          Se connecter →
        </button>
        
      </form>

      <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--csn-border)' }}>
        <Link href="/register"
          className="w-full block text-center py-2.5 rounded-lg text-[13px] transition-colors hover:bg-slate-50"
          style={{ border: '0.5px solid var(--csn-border-strong)', color: 'var(--csn-blue)' }}>
          Demander un accès
        </Link>
      </div>
    </>
  )
}