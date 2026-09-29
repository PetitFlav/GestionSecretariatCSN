import { Suspense } from 'react'
import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import ResetPasswordForm from './ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <Suspense fallback={<div className="text-sm text-slate-400">Chargement…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthLayout>
  )
}
