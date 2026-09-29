'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { forgotPasswordAction } from '@/app/actions/password'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white transition-opacity disabled:opacity-60"
      style={{ background: 'var(--csn-navy)' }}>
      {pending ? 'Envoi…' : 'Recevoir un lien →'}
    </button>
  )
}

export default function ForgotPasswordForm() {
  const [state, action] = useFormState(forgotPasswordAction, {})

  return (
    <>
      <h1 className="text-[15px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
        Mot de passe oublié
      </h1>
      <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
        Saisissez l&apos;adresse email de votre compte. Vous recevrez un lien pour
        choisir un nouveau mot de passe.
      </p>

      {state?.error && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4 leading-relaxed"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.error}
        </div>
      )}

      {state?.success ? (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4 leading-relaxed"
          style={{ background: '#eaf7f0', border: '0.5px solid #7dd4a8', color: '#1a6642' }}>
          {state.success}
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-0">
          <label className="text-[12px] text-slate-500 mb-1.5 block">Adresse email</label>
          <input type="email" name="email" placeholder="prenom.nom@csn.fr"
            autoComplete="email" required
            className="w-full px-3 py-2 text-[14px] rounded-lg mb-5 outline-none transition-all"
            style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
          />
          <SubmitButton />
        </form>
      )}

      <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--csn-border)' }}>
        <Link href="/login"
          className="w-full block text-center py-2.5 rounded-lg text-[13px] transition-colors hover:bg-slate-50"
          style={{ border: '0.5px solid var(--csn-border-strong)', color: 'var(--csn-blue)' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </>
  )
}
