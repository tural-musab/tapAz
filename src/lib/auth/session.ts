import { cookies } from 'next/headers';
import type { AuthRole } from '@/lib/auth/users';

export const ROLE_COOKIE = 'tapaz-role';
export const USERNAME_COOKIE = 'tapaz-username';

export interface SessionInfo {
  role?: AuthRole;
  username?: string;
}

export const readSession = async (): Promise<SessionInfo> => {
  const cookieStore = await cookies();
  const role = cookieStore.get(ROLE_COOKIE)?.value as AuthRole | undefined;
  const username = cookieStore.get(USERNAME_COOKIE)?.value;
  return { role, username };
};

export const isAdminSession = (session: SessionInfo) => session.role === 'admin';
