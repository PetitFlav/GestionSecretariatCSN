import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import ForgotPasswordForm from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <ForgotPasswordForm />
      </AuthCard>
    </AuthLayout>
  )
}
