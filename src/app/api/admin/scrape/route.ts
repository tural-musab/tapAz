import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminSearchParams } from '@/lib/admin/auth';
import { startScrapeJob } from '@/lib/admin/scraperRunner';
import { listJobs } from '@/lib/admin/jobsStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const buildSearchParams = (request: Request): AdminSearchParams => {
  const url = new URL(request.url);
  const params: AdminSearchParams = {};
  url.searchParams.forEach((value, key) => {
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

const scrapeRequestSchema = z.object({
  categoryUrls: z.array(z.string().url()).min(1),
  selections: z
    .array(
      z.object({
        categoryId: z.string(),
        subcategoryId: z.string().optional(),
        label: z.string().optional()
      })
    )
    .default([]),
  pageLimit: z.number().int().min(1).max(10),
  listingLimit: z.number().int().min(10).max(1000),
  delayMs: z.number().int().min(250).max(20000),
  detailDelayMs: z.number().int().min(250).max(20000),
  headless: z.boolean().default(true),
  userAgent: z.string().min(5).max(256).optional()
});

const buildErrorResponse = (message: string, status = 400) =>
  NextResponse.json(
    {
      error: message
    },
    { status }
  );

export async function GET(request: Request) {
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  const jobs = await listJobs(25);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return buildErrorResponse('JSON body tələb olunur');
  }

  const parsed = scrapeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return buildErrorResponse(parsed.error.flatten().formErrors.join(', ') || 'Parametrlər düzgün deyil');
  }

  const job = await startScrapeJob({
    ...parsed.data,
    triggeredBy: auth.tokenSource ?? 'unknown'
  });

  return NextResponse.json({ job });
}
