import AuthLayout from '@/components/AuthLayout'
import AuthCard from '@/components/AuthCard'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <LoginForm />
      </AuthCard>
    </AuthLayout>
  )
}