import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import RegisterForm from './RegisterForm'

export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <RegisterForm />
      </AuthCard>
    </AuthLayout>
  )
}
