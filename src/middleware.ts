import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_COOKIE } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/site.webmanifest') ||
    pathname.match(/\.(.*)$/) ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (!role) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/' && pathname !== '/login') {
      loginUrl.searchParams.set('returnTo', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/public).*)']
};
