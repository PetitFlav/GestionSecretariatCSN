import { Suspense } from 'react'
import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import SetupPasswordForm from './SetupPasswordForm'

export default function SetupPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <Suspense fallback={<div className="text-sm text-slate-400">Chargement…</div>}>
          <SetupPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthLayout>
  )
}