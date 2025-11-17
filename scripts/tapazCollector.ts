import path from 'node:path';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { z } from 'zod';
import categoriesFallback from '@/data/categories.json';

const BASE_URL = 'https://tap.az';
const USER_AGENT = 'Tapaz-AnalyticsBot/0.1 (research contact: [email protected])';
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_PAGES_PER_CATEGORY = Number(process.env.MAX_PAGES ?? 2);
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'snapshots');

interface CategoryLink {
  id: string;
  name: string;
  url: string;
}

const listingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  categoryId: z.string(),
  subcategoryId: z.string().optional(),
  price: z.number(),
  currency: z.literal('AZN'),
  isNew: z.boolean(),
  sellerType: z.enum(['store', 'individual']),
  sellerName: z.string(),
  sellerHandle: z.string().optional(),
  city: z.string(),
  postedAt: z.string(),
  viewCount: z.number(),
  favoriteCount: z.number(),
  listingUrl: z.string(),
  imageUrl: z.string().optional()
});

type ScrapedListing = z.infer<typeof listingSchema>;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'az-AZ,az;q=0.9,tr;q=0.8,en;q=0.7',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: BASE_URL
};

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS
  });

  if (response.status === 403) {
    throw new Error(
      'Tap.az sorğunu blokladı (403). Brauzer əsaslı və ya rəsmi girişli toplayıcıya ehtiyac var.'
    );
  }

  if (!response.ok) {
    throw new Error(`Sorğu uğursuz oldu (${response.status})`);
  }
  return response.text();
};

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/₼/g, 'AZN')
    .trim();

const extractNumber = (value: string) => {
  const numeric = value.replace(/[^\d]/g, '');
  return numeric ? Number(numeric) : 0;
};

const scrapeCategories = async (): Promise<CategoryLink[]> => {
  try {
    const html = await fetchHtml(BASE_URL);
    const $ = cheerio.load(html);

    const catalogLinks = new Map<string, CategoryLink>();

    $('a[href^="/elanlar"]').each((_, element) => {
      const href = $(element).attr('href');
      const label = normalizeText($(element).text());
      const categoryId = href?.split('/')[2];

      if (!href || !label || !categoryId) return;
      if (catalogLinks.has(categoryId)) return;

      catalogLinks.set(categoryId, {
        id: categoryId,
        name: label,
        url: new URL(href, BASE_URL).toString()
      });
    });

    if (catalogLinks.size > 0) {
      return Array.from(catalogLinks.values());
    }
  } catch (error) {
    console.warn('Canlı sayt strukturu oxunmadı, fallback kateqoriyalarından istifadə ediləcək.', error);
  }

  const fallbackCategories = categoriesFallback as Array<{ id: string; name: string }>;
  return fallbackCategories.map<CategoryLink>((category) => ({
    id: category.id,
    name: category.name,
    url: `${BASE_URL}/elanlar/${category.id}`
  }));
};

const extractListingLinks = (html: string) => {
  const $ = cheerio.load(html);
  const links: string[] = [];

  const selectors = ['a.products-link', 'a[data-testid="product-card"]', 'a.products-i__link'];

  selectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      links.push(new URL(href, BASE_URL).toString());
    });
  });

  if (links.length > 0) return links;

  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || !href.includes('/elanlar/')) return;
    links.push(new URL(href, BASE_URL).toString());
  });

  return links;
};

const scrapeListingDetail = async (url: string, categoryId: string): Promise<ScrapedListing | null> => {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const title = normalizeText($('h1.product-title').text());
  if (!title) return null;

  const description = normalizeText($('div.product-description').text());
  const priceText = normalizeText($('[data-testid="price"]').first().text());
  const price = extractNumber(priceText);

  const city = normalizeText($('span[data-testid="city"]').text());
  const postedAt = $('time').attr('datetime') ?? new Date().toISOString();
  const viewCount = extractNumber($('span[data-testid="views"]').text());
  const favoriteCount = extractNumber($('span[data-testid="favorites"]').text());
  const sellerName = normalizeText($('div.seller-info strong').first().text());
  const sellerType = $('div.seller-info').hasClass('is-shop') ? 'store' : 'individual';

  const imageUrl = $('div.product-gallery img')
    .first()
    .attr('src');

  const productBadges = $('div.product-labels span')
    .map((_, element) => normalizeText($(element).text()))
    .get();
  const isNew = productBadges.includes('Yeni');

  const subcategoryId = $('.breadcrumbs a')
    .last()
    .attr('href')
    ?.split('/')
    .pop();

  const listing = {
    id: url.split('/').pop() ?? crypto.randomUUID(),
    title,
    description,
    categoryId,
    subcategoryId,
    price,
    currency: 'AZN' as const,
    isNew,
    sellerType,
    sellerName: sellerName || 'Naməlum satıcı',
    sellerHandle: $('div.seller-info small').text() || undefined,
    city: city || 'Bakı',
    postedAt,
    viewCount,
    favoriteCount,
    listingUrl: url,
    imageUrl
  };

  const parsed = listingSchema.safeParse(listing);
  if (!parsed.success) {
    console.warn('Elan sxemi ilə uyğun gəlmədi', parsed.error.flatten());
    return null;
  }

  return parsed.data;
};

const scrapeCategoryListings = async (category: CategoryLink): Promise<ScrapedListing[]> => {
  const listings: ScrapedListing[] = [];
  const limit = pLimit(MAX_CONCURRENT_REQUESTS);

  for (let page = 1; page <= MAX_PAGES_PER_CATEGORY; page += 1) {
    const pageUrl = `${category.url}?page=${page}`;
    const html = await fetchHtml(pageUrl);
    const detailLinks = extractListingLinks(html);

    if (detailLinks.length === 0) break;

    const results = await Promise.all(
      detailLinks.map((detailUrl) =>
        limit(async () => {
          await delay(500); // etik gecikmə
          return scrapeListingDetail(detailUrl, category.id);
        })
      )
    );

    listings.push(...results.filter(Boolean) as ScrapedListing[]);

    if (detailLinks.length < 20) break; // son səhifə hesab et
  }

  return listings;
};

const persistSnapshot = async (data: ScrapedListing[]) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(OUTPUT_DIR, `tapaz-listings-${timestamp}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
};

export const runCollector = async () => {
  const categories = (await scrapeCategories()).filter((category) => category.id !== 'jobs');
  const targetCategories = categories.slice(0, Number(process.env.CATEGORY_LIMIT ?? 3));
  const allListings: ScrapedListing[] = [];

  for (const category of targetCategories) {
    console.log(`>> Kateqoriya oxunur: ${category.name}`);
    const categoryListings = await scrapeCategoryListings(category);
    console.log(`   ${categoryListings.length} elan hazırdır.`);
    allListings.push(...categoryListings);
  }

  const filePath = await persistSnapshot(allListings);
  console.log(`Tamamlandı! ${allListings.length} elan ${filePath} faylına yazıldı.`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCollector().catch((error) => {
    console.error('Toplayıcı skriptində səhv baş verdi', error);
    process.exit(1);
  });
}

