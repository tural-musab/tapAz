import { NextResponse } from 'next/server';
import { ROLE_COOKIE, USERNAME_COOKIE } from '@/lib/auth/session';
import { ADMIN_COOKIE_NAME } from '@/lib/admin/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  const clear = (name: string) => response.cookies.set(name, '', { path: '/', maxAge: 0 });
  clear(ROLE_COOKIE);
  clear(USERNAME_COOKIE);
  clear(ADMIN_COOKIE_NAME);
  return response;
}
