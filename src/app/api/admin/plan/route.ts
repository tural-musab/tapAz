import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminSearchParams } from '@/lib/admin/auth';
import { loadNightlyPlan, persistNightlyPlan } from '@/lib/admin/planStore';
import type { AdminNightlyPlanState } from '@/lib/admin/types';
import { getCategories } from '@/lib/data';
import type { Category } from '@/lib/types';

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

const scheduleTypeEnum = z.enum(['daily', 'weekly', 'monthly']);
const categoryStrategyEnum = z.enum(['all', 'custom']);
const weekdayEnum = z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

const planSchema = z
  .object({
    scheduleType: scheduleTypeEnum,
    runHour: z.number().int().min(0).max(23),
    runMinute: z.number().int().min(0).max(59),
    timezone: z.string().min(2).max(64),
    daysOfWeek: z.array(weekdayEnum).default([]),
    daysOfMonth: z
      .array(
        z
          .number()
          .int()
          .min(1)
          .max(31)
      )
      .default([]),
    categoryStrategy: categoryStrategyEnum.default('all'),
    includeCategoryIds: z.array(z.string()),
    excludeCategoryIds: z.array(z.string()),
    intervalMinutes: z.number().int().min(1).max(120).default(5),
    cronExpression: z.string().optional(),
    lastUpdatedAt: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.scheduleType === 'weekly' && value.daysOfWeek.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ən az bir həftə günü seçilməlidir.' });
    }
    if (value.scheduleType === 'monthly' && value.daysOfMonth.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ən az bir ay günü seçilməlidir.' });
    }
    if (value.categoryStrategy === 'custom' && value.includeCategoryIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Kateqoriya siyahısı boş ola bilməz.' });
    }
  });

const buildErrorResponse = (message: string, status = 400) =>
  NextResponse.json(
    {
      error: message
    },
    { status }
  );

const buildCategoryQueue = (plan: AdminNightlyPlanState) => {
  const categories = getCategories();
  const categoryMap = new Map<string, Category>();
  categories.forEach((category) => {
    categoryMap.set(category.id, category);
  });

  const slugFor = (category: Category) => category.slug ?? category.id;

  const queue =
    plan.categoryStrategy === 'all'
      ? categories.filter((category) => !plan.excludeCategoryIds.includes(category.id))
      : plan.includeCategoryIds.map((categoryId) => categoryMap.get(categoryId)).filter((category): category is Category => Boolean(category));

  return queue.map((category) => ({
    id: category.id,
    name: category.name,
    slug: slugFor(category),
    url: `https://tap.az/elanlar/${slugFor(category)}`
  }));
};

export async function GET(request: NextRequest) {
  const auth = await validateAdminAccess(buildSearchParams(request));
  if (!auth.allowed) {
    return buildErrorResponse(auth.message ?? 'Token tələb olunur', 401);
  }

  const payload = await loadNightlyPlan();
  const categoryQueue = buildCategoryQueue(payload.plan);
  return NextResponse.json({ ...payload, categoryQueue });
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
      cronExpression: parsed.cronExpression ?? '',
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString()
    };
  } catch (error) {
    return buildErrorResponse((error as Error).message ?? 'Parametrlər düzgün deyil');
  }

  const result = await persistNightlyPlan(parsedBody, { actor: auth.tokenSource });
  const categoryQueue = buildCategoryQueue(result.plan);
  return NextResponse.json({ ...result, categoryQueue });
}
