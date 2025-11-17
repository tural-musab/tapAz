import { cookies, headers } from 'next/headers';

export type AdminTokenSource = 'cookie' | 'header' | 'query' | 'disabled';

export interface AdminAuthResult {
  allowed: boolean;
  message?: string;
  tokenSource?: AdminTokenSource;
}

export type AdminSearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_COOKIE_NAME = 'tapaz-admin-token';

const normalizeAuthHeader = (value?: string | null) => {
  if (!value) {
    return undefined;
  }

  if (value.startsWith('Bearer ')) {
    return value.replace('Bearer ', '').trim();
  }

  if (value.startsWith('Basic ')) {
    return value.replace('Basic ', '').trim();
  }

  return value.trim();
};

export const validateAdminAccess = (searchParams: AdminSearchParams): AdminAuthResult => {
  const requiredToken = process.env.ADMIN_DASHBOARD_TOKEN;

  if (!requiredToken) {
    return {
      allowed: true,
      message: 'ADMIN_DASHBOARD_TOKEN təyin edilmədiyi üçün giriş məhdudlaşdırılmayıb.',
      tokenSource: 'disabled'
    };
  }

  const cookieStore = cookies();
  const cookieToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const headerToken = headers().get('x-admin-token') || normalizeAuthHeader(headers().get('authorization'));
  const queryTokenParam = searchParams?.token;
  const queryToken = Array.isArray(queryTokenParam) ? queryTokenParam[0] : queryTokenParam;

  const resolvedSources: Array<{ value?: string; source: AdminTokenSource }> = [
    { value: cookieToken, source: 'cookie' },
    { value: headerToken, source: 'header' },
    { value: queryToken, source: 'query' }
  ];

  const matchedSource = resolvedSources.find((entry) => entry.value && entry.value === requiredToken);

  if (matchedSource) {
    return {
      allowed: true,
      message: `Token ${matchedSource.source} vasitəsilə təsdiqləndi.`,
      tokenSource: matchedSource.source
    };
  }

  return {
    allowed: false,
    message:
      'Admin panel üçün düzgün token təqdim edilməyib. `x-admin-token` header-i, `token` query param-ı və ya uyğun cookie istifadə edin.'
  };
};
