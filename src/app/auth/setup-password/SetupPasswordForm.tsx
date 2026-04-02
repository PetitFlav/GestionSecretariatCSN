'use client'

import { useFormState } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import StepIndicator from '@/components/StepIndicator'
import { setupPasswordAction } from '@/app/actions/auth'

export default function SetupPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, action] = useFormState(setupPasswordAction, {})

  if (!token) {
    return (
      <div className="rounded-lg px-3.5 py-2.5 text-[13px]"
        style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
        Lien invalide ou manquant. Contactez un administrateur.
      </div>
    )
  }

  return (
    <>
      <StepIndicator currentStep={3} />

      <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-5 leading-relaxed"
        style={{ background: '#eaf7f0', border: '0.5px solid #7dd4a8', color: '#1a6642' }}>
        Votre accès a été approuvé. Choisissez maintenant votre mot de passe.
      </div>

      <h1 className="text-[15px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
        Créer votre mot de passe
      </h1>
      <p className="text-[13px] text-slate-500 mb-5">Minimum 8 caractères.</p>

      {state?.error && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.error}
        </div>
      )}

      <form action={action} className="flex flex-col gap-0">
        <input type="hidden" name="token" value={token} />

        <label className="text-[12px] text-slate-500 mb-1.5 block">Mot de passe</label>
        <input
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full px-3 py-2 text-[14px] rounded-lg mb-4 outline-none transition-all"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
        />

        <label className="text-[12px] text-slate-500 mb-1.5 block">Confirmer le mot de passe</label>
        <input
          type="password"
          name="confirmPassword"
          placeholder="••••••••"
          autoComplete="new-password"
          required
          className="w-full px-3 py-2 text-[14px] rounded-lg mb-5 outline-none transition-all"
          style={{ border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }}
        />

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--csn-navy)' }}>
          Valider et accéder →
        </button>
      </form>
    </>
  )
}