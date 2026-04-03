import Image from 'next/image'
import Link from 'next/link'
import { SessionUser } from '@/lib/session'
import { logoutAction } from '@/app/actions/auth'
import BackButton from '@/components/BackButton'
import ConfigMenu from '@/components/ConfigMenu'

interface TopBarProps {
  user?: SessionUser | null
  showBack?: boolean
}

export default function TopBar({ user, showBack = false }: TopBarProps) {
  return (
    <header
      className="bg-white border-b flex items-center justify-between px-5 h-[52px] flex-shrink-0"
      style={{ borderColor: 'var(--csn-border-strong)' }}
    >
      {/* Gauche : bouton retour + logo + titre */}
      <div className="flex items-center gap-3">
        {showBack && <BackButton />}

        <Link href="/" className="flex items-center gap-3">
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
            className="text-[13px] font-medium tracking-wide hidden sm:block"
            style={{ color: 'var(--csn-navy)' }}
          >
            Gestion Secrétariat CSN
          </span>
        </Link>
      </div>

      {/* Droite : utilisateur + config + déconnexion */}
      {user && (
        <div className="flex items-center gap-2">
          {/* Nom utilisateur */}
          <span className="text-[12px] font-medium hidden sm:block" style={{ color: 'var(--csn-blue)' }}>
            {user.firstName || user.email}
            {user.role !== 'USER' && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: user.role === 'SUPERUSER' ? '#eeedfe' : '#e6f1fb',
                  color:      user.role === 'SUPERUSER' ? '#3c3489' : '#185fa5',
                }}
              >
                {user.role === 'SUPERUSER' ? 'superuser' : 'admin'}
              </span>
            )}
          </span>

          {/* Menu Config (dropdown) */}
          <ConfigMenu user={user} />

          {/* Déconnexion */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              style={{ borderColor: 'var(--csn-border-strong)', color: '#64748b' }}
            >
              Déconnexion
            </button>
          </form>
        </div>
      )}
    </header>
  )
}
