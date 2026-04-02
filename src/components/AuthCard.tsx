interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export default function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-7 w-full max-w-sm ${className}`}
      style={{ border: '0.5px solid var(--csn-border-strong)' }}
    >
      {children}
    </div>
  )
}
