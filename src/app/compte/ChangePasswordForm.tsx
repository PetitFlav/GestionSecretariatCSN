'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { changePasswordAction } from '@/app/actions/password'

const inputClass = 'w-full px-3 py-2 text-[13px] rounded-lg outline-none mb-4'
const inputStyle = { border: '0.5px solid var(--csn-border-strong)', background: 'var(--csn-cream)', color: 'var(--csn-navy)' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60 transition-opacity"
      style={{ background: 'var(--csn-navy)' }}>
      {pending ? 'Enregistrement…' : 'Changer le mot de passe'}
    </button>
  )
}

export default function ChangePasswordForm() {
  const [state, action] = useFormState(changePasswordAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  // Vide les champs après un changement réussi
  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-0">
      {(state?.error || state?.success) && (
        <div className="rounded-lg px-3.5 py-2.5 text-[13px] mb-4"
          style={state.success
            ? { background: '#eaf7f0', border: '0.5px solid #7dd4a8', color: '#1a6642' }
            : { background: '#fff3cd', border: '0.5px solid #e8c96a', color: '#7a5a00' }}>
          {state.success ?? state.error}
        </div>
      )}

      <label className="text-[12px] text-slate-500 mb-1.5 block">Mot de passe actuel</label>
      <input type="password" name="currentPassword" autoComplete="current-password" required
        className={inputClass} style={inputStyle} />

      <label className="text-[12px] text-slate-500 mb-1.5 block">Nouveau mot de passe</label>
      <input type="password" name="password" autoComplete="new-password" minLength={8} required
        className={inputClass} style={inputStyle} />

      <label className="text-[12px] text-slate-500 mb-1.5 block">Confirmer le nouveau mot de passe</label>
      <input type="password" name="confirmPassword" autoComplete="new-password" required
        className={inputClass} style={inputStyle} />

      <SubmitButton />

      <p className="text-[11px] text-slate-400 mt-3">
        Mot de passe actuel oublié ?{' '}
        <Link href="/auth/forgot-password" className="underline" style={{ color: 'var(--csn-blue)' }}>
          Recevoir un lien par email
        </Link>
      </p>
    </form>
  )
}
