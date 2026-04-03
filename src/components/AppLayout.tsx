import TopBar from '@/components/TopBar'
import BottomBar from '@/components/BottomBar'
import { SessionUser } from '@/lib/session'

interface AppLayoutProps {
  children: React.ReactNode
  user: SessionUser
  showBack?: boolean
}

export default function AppLayout({ children, user, showBack }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--csn-cream)' }}>
      <TopBar user={user} showBack={showBack} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <BottomBar />
    </div>
  )
}
