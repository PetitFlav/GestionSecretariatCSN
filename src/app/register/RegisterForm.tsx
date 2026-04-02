'use client'

import { useEffect } from 'react'
import { useFormState } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StepIndicator from '@/components/StepIndicator'
import { registerAction } from '@/app/actions/auth'

export default function RegisterForm() {
  const router = useRouter()
  const [state, action] = useFormState(registerAction, {})

  useEffect(() => {
    if (state?.success === 'ok') {
      router.push('/register/pending')
    }
  }, [state, router])

  return (
    <>
      <StepIndicator currentStep={1} />

      <h1 className="text-[15px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
        Demander un accès
      </h1>
      <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
        Saisissez votre adresse email. Un administrateur validera votre demande
        et vous recevrez un lien pour créer votre mot de passe.
      </p>

      {state?.error && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4 leading-relaxed"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.error}
        </div>
      )}

      {state?.success && state.success !== 'ok' && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4"
          style={{ background: '#eaf7f0', border: '0.5px solid #7dd4a8', color: '#1a6642' }}>
          {state.success}
        </div>
      )}

      <form action={action}>
        <label className="text-[12px] text-slate-500 mb-1.5 block">
          Adresse email
        </label>
        <input
          type="email"
          name="email"
          placeholder="prenom.nom@csn.fr"
          autoComplete="email"
          required
          className="w-full px-3 py-2 text-[14px] rounded-lg mb-5 outline-none transition-all"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
        />
        <button
          type="submit"
          className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--csn-navy)' }}>
          Envoyer la demande →
        </button>
      </form>

      <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--csn-border)' }}>
        <Link href="/login"
          className="block text-center text-[13px] transition-colors hover:underline"
          style={{ color: 'var(--csn-blue)' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </>
  )
}
