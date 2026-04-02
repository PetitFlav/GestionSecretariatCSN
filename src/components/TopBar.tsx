import Image from 'next/image'
import Link from 'next/link'
import { SessionUser } from '@/lib/session'
import { logoutAction } from '@/app/actions/auth'

interface TopBarProps {
  user?: SessionUser | null
}

export default function TopBar({ user }: TopBarProps) {
  return (
    <header
      className="bg-white border-b flex items-center justify-between px-5 h-[52px] flex-shrink-0"
      style={{ borderColor: 'var(--csn-border-strong)' }}
    >
      {/* Gauche : logo + titre */}
      <div className="flex items-center gap-3">
        <Image
          src="/logo-csn.png"
          alt="Logo CSN"
          width={36}
          height={36}
          className="object-contain"
          priority
        />
        <div
          className="w-px h-6"
          style={{ background: 'var(--csn-border-strong)' }}
        />
        <span
          className="text-[13px] font-medium tracking-wide"
          style={{ color: 'var(--csn-navy)' }}
        >
          Gestion Secrétariat CSN
        </span>
      </div>

      {/* Droite : utilisateur + config */}
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium" style={{ color: 'var(--csn-blue)' }}>
            {user.firstName || user.email}
            {user.role !== 'USER' && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: user.role === 'SUPERUSER' ? '#eeedfe' : '#e6f1fb',
                  color: user.role === 'SUPERUSER' ? '#3c3489' : '#185fa5',
                }}
              >
                {user.role === 'SUPERUSER' ? 'superuser' : 'admin'}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {(user.role === 'ADMIN' || user.role === 'SUPERUSER') && (
              <Link
                href="/admin/users"
                className="text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                style={{
                  borderColor: 'var(--csn-border-strong)',
                  color: 'var(--csn-navy)',
                }}
              >
                Utilisateurs
              </Link>
            )}
            <Link
              href="/config"
              className="text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 flex items-center gap-1"
              style={{
                borderColor: 'var(--csn-border-strong)',
                color: 'var(--csn-navy)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Config
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                style={{
                  borderColor: 'var(--csn-border-strong)',
                  color: '#64748b',
                }}
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
