import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionUser } from '@/lib/session'

// Routes publiques (pas de redirect)
const PUBLIC_ROUTES = ['/login', '/register', '/auth/setup-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer les routes publiques et assets
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Vérifier la session
  const response = NextResponse.next()
  const session = await getIronSession<{ user?: SessionUser }>(
    request,
    response,
    sessionOptions
  )

  if (!session.user || session.user.status !== 'ACTIVE') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Protection des routes admin
  if (
    pathname.startsWith('/admin') &&
    session.user.role !== 'ADMIN' &&
    session.user.role !== 'SUPERUSER'
  ) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
