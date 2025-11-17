import { NextResponse, type NextRequest } from 'next/server';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminSearchParams } from '@/lib/admin/auth';
import { fetchLatestDeployments } from '@/lib/admin/vercel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const buildSearchParams = (request: NextRequest): AdminSearchParams => {
  const params: AdminSearchParams = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing === undefined) {
      params[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      params[key] = [existing as string, value];
    }
  });
  return params;
};

const buildErrorResponse = (message: string, status = 400) =>
  NextResponse.json(
    {
      error: message
    },
    { status }
  );

export async function GET(request: NextRequest) {
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  const result = await fetchLatestDeployments(5);
  return NextResponse.json(result);
}
