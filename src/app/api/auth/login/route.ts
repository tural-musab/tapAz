import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/users';
import { ROLE_COOKIE, USERNAME_COOKIE } from '@/lib/auth/session';
import { ADMIN_COOKIE_NAME } from '@/lib/admin/auth';

type LoginBody = {
  username?: string;
  password?: string;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: 'İstifadəçi adı və şifrə tələb olunur.' }, { status: 400 });
  }

  const user = authenticateUser(username, password);
  if (!user) {
    return NextResponse.json({ error: 'Yanlış istifadəçi adı və ya şifrə.' }, { status: 401 });
  }

  const response = NextResponse.json({ role: user.role, username: user.username });
  response.cookies.set(ROLE_COOKIE, user.role, cookieOptions);
  response.cookies.set(USERNAME_COOKIE, user.username, cookieOptions);

  if (user.role === 'admin') {
    const adminToken = process.env.ADMIN_DASHBOARD_TOKEN;
    if (adminToken) {
      response.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 4
      });
    }
  } else {
    response.cookies.set(ADMIN_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  }

  return response;
}
