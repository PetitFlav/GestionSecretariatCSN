import Image from 'next/image'
import BottomBar from '@/components/BottomBar'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--csn-cream)' }}>
      {/* Header simplifié pour les pages d'auth */}
      <header
        className="bg-white border-b flex items-center px-5 h-[52px] flex-shrink-0"
        style={{ borderColor: 'var(--csn-border-strong)' }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo-csn.png"
            alt="Logo CSN"
            width={36}
            height={36}
            className="object-contain"
            priority
          />
          <div className="w-px h-6" style={{ background: 'var(--csn-border-strong)' }} />
          <span
            className="text-[13px] font-medium tracking-wide"
            style={{ color: 'var(--csn-navy)' }}
          >
            Gestion Secrétariat CSN
          </span>
        </div>
      </header>

      {/* Contenu centré */}
      <main className="flex-1 flex items-start justify-center pt-12 px-4">
        {children}
      </main>

      <BottomBar />
    </div>
  )
}
