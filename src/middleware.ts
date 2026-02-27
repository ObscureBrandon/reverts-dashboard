import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware for route protection.
 * 
 * Checks for the better-auth session token cookie to determine if
 * the user is authenticated. Unauthenticated users are redirected to /login.
 * 
 * Role-based access (mod vs user) is enforced at the component/API level
 * since middleware runs at the edge and can't query the database.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow: login, API routes, static assets, auth callbacks
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next()
  }

  // Check for session token cookie (better-auth stores it as "better-auth.session_token")
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value

  if (!sessionToken) {
    // Redirect to login with callback URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files and API
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
