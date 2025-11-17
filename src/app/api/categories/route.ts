import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/data';

export const dynamic = 'force-static';

export async function GET() {
  const categories = getCategories().map((category) => ({
    id: category.id,
    name: category.name,
    note: category.note,
    subcategories: category.subcategories
  }));

  return NextResponse.json({ categories });
}

