import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminSearchParams } from '@/lib/admin/auth';
import { loadNightlyPlan, persistNightlyPlan } from '@/lib/admin/planStore';
import type { AdminNightlyPlanState } from '@/lib/admin/types';

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

const planSchema = z.object({
  cronExpression: z.string().min(5).max(64),
  timezone: z.string().min(2).max(64),
  includeCategoryIds: z.array(z.string()),
  excludeCategoryIds: z.array(z.string()),
  lastUpdatedAt: z.string().optional()
});

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

  const payload = await loadNightlyPlan();
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  let parsedBody: AdminNightlyPlanState;
  try {
    const json = await request.json();
    const parsed = planSchema.parse(json);
    parsedBody = {
      ...parsed,
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString()
    };
  } catch (error) {
    return buildErrorResponse((error as Error).message ?? 'Parametrlər düzgün deyil');
  }

  const result = await persistNightlyPlan(parsedBody, { actor: auth.tokenSource });
  return NextResponse.json(result);
}
