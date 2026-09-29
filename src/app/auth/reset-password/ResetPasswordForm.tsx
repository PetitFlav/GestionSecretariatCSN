'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
// Même logique que la création initiale : token + expiry sur User, puis connexion auto
import { setupPasswordAction } from '@/app/actions/auth'

const inputClass = 'w-full px-3 py-2 text-[14px] rounded-lg outline-none transition-all'
const inputStyle = { border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: '#1a2e3f' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full py-2.5 rounded-lg text-[14px] font-medium text-white transition-opacity disabled:opacity-60"
      style={{ background: 'var(--csn-navy)' }}>
      {pending ? 'Enregistrement…' : 'Valider et se connecter →'}
    </button>
  )
}

export default function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? ''
  const [state, action] = useFormState(setupPasswordAction, {})

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg px-3.5 py-2.5 text-[13px]"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          Lien invalide ou incomplet.
        </div>
        <Link href="/auth/forgot-password" className="text-[13px] text-center" style={{ color: 'var(--csn-blue)' }}>
          Demander un nouveau lien
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-[15px] font-medium mb-1" style={{ color: 'var(--csn-navy)' }}>
        Nouveau mot de passe
      </h1>
      <p className="text-[13px] text-slate-500 mb-5">Minimum 8 caractères.</p>

      {state?.error && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4 leading-relaxed"
          style={{ background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.error}{' '}
          <Link href="/auth/forgot-password" className="underline">Demander un nouveau lien</Link>
        </div>
      )}

      <form action={action} className="flex flex-col gap-0">
        <input type="hidden" name="token" value={token} />

        <label className="text-[12px] text-slate-500 mb-1.5 block">Nouveau mot de passe</label>
        <input type="password" name="password" placeholder="••••••••"
          autoComplete="new-password" minLength={8} required
          className={`${inputClass} mb-4`} style={inputStyle} />

        <label className="text-[12px] text-slate-500 mb-1.5 block">Confirmer le mot de passe</label>
        <input type="password" name="confirmPassword" placeholder="••••••••"
          autoComplete="new-password" required
          className={`${inputClass} mb-5`} style={inputStyle} />

        <SubmitButton />
      </form>
    </>
  )
}
