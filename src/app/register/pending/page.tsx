import Link from 'next/link'
import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import StepIndicator from '@/components/StepIndicator'

export default function RegisterPendingPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <StepIndicator currentStep={2} />

        <div
          className="rounded-lg px-3.5 py-3 text-[13px] mb-5 leading-relaxed"
          style={{
            background: '#fff8e6',
            border: '0.5px solid #e8c96a',
            color: '#7a5a00',
          }}
        >
          Votre demande d&apos;accès a bien été envoyée. Un administrateur va
          la traiter prochainement. Vous recevrez un email avec un lien pour
          créer votre mot de passe dès validation.
        </div>

        <Link
          href="/login"
          className="w-full block text-center py-2.5 rounded-lg text-[13px] transition-colors hover:bg-slate-50"
          style={{
            border: '0.5px solid var(--csn-border-strong)',
            color: 'var(--csn-blue)',
          }}
        >
          ← Retour à la connexion
        </Link>
      </AuthCard>
    </AuthLayout>
  )
}
