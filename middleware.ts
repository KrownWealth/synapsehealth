import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'sepsofa-session';

const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = req.cookies.get(COOKIE_NAME);
  if (session?.value) return NextResponse.next();

  // For API routes, return 401 JSON rather than redirecting.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  // Preserve the originally-requested path so we can redirect back after sign-in.
  loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

// Apply to everything except Next.js internals and static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)).*)'],
};
