import { NextResponse, type NextRequest } from 'next/server';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminSearchParams } from '@/lib/admin/auth';
import { getJobById, getJobLog } from '@/lib/admin/jobsStore';

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

const buildErrorResponse = (message: string, status = 400) =>
  NextResponse.json(
    {
      error: message
    },
    { status }
  );

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const resolvedParams = await params;
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  const job = await getJobById(resolvedParams.jobId);
  if (!job) {
    return buildErrorResponse('Job tapılmadı', 404);
  }

  const url = new URL(request.url);
  const includeLog = url.searchParams.get('includeLog') === 'true';
  const log = includeLog ? await getJobLog(resolvedParams.jobId) : undefined;

  return NextResponse.json({ job, log });
}
