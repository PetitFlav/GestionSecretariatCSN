'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SessionUser } from '@/lib/session'

interface ConfigMenuProps {
  user: SessionUser
}

export default function ConfigMenu({ user }: ConfigMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERUSER'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--csn-border-strong)', color: 'var(--csn-navy)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Config
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 bg-white rounded-xl py-1 z-50 min-w-[200px]"
          style={{ border: '0.5px solid var(--csn-border-strong)', boxShadow: '0 4px 16px rgba(26,58,92,0.08)' }}
        >
          {/* SMTP / Config générale */}
          <MenuItem href="/config" icon="smtp" label="Configuration SMTP" onClick={() => setOpen(false)} />

          {/* Admin uniquement */}
          {isAdmin && (
            <>
              <div
                className="mx-3 my-1"
                style={{ borderTop: '0.5px solid var(--csn-border)' }}
              />
              <div className="px-3 py-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                  Administration
                </span>
              </div>
              <MenuItem href="/saisons"      icon="saison"      label="Gestion des saisons"      onClick={() => setOpen(false)} />
              <MenuItem href="/admin/users"  icon="users"       label="Utilisateurs"             onClick={() => setOpen(false)} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string
  icon: 'smtp' | 'saison' | 'users'
  label: string
  onClick: () => void
}) {
  const icons = {
    smtp: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    saison: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    users: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors hover:bg-slate-50 mx-1 rounded-lg"
      style={{ color: 'var(--csn-navy)' }}
    >
      <span className="text-slate-400">{icons[icon]}</span>
      {label}
    </Link>
  )
}
