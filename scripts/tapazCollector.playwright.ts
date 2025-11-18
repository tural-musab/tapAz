import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from 'playwright';

const PROGRESS_PREFIX = '__PROGRESS__';
const reportProgress = (payload: Record<string, unknown>) => {
  console.log(`${PROGRESS_PREFIX}${JSON.stringify(payload)}`);
};

interface BaseListingCard {
  tapId: string;
  title: string;
  price?: number;
  currency?: string;
  location?: string;
  url: string;
  imageUrl?: string;
  categorySlug?: string;
  subcategorySlug?: string;
}

interface ListingDetail {
  description?: string;
  sellerName?: string;
  sellerType?: 'store' | 'individual';
  postedAtText?: string;
  postedAtISO?: string;
  conditionLabel?: string;
  viewCount?: number;
  favoritesCount?: number;
  price?: number;
  currency?: string;
  imageUrl?: string;
  isNew?: boolean;
  jsonLd?: Record<string, unknown>;
}

interface ScrapedListing extends BaseListingCard {
  description?: string;
  sellerName?: string;
  sellerType?: 'store' | 'individual';
  postedAtText?: string;
  postedAtISO?: string;
  conditionLabel?: string;
  viewCount?: number;
  favoritesCount?: number;
  isNew?: boolean;
  fetchedAt: string;
  raw?: ListingDetail;
}

type JsonLdOffer = {
  seller?: { name?: string };
  priceCurrency?: string;
  availabilityStarts?: string;
};

type JsonLdProduct = {
  '@type'?: string;
  description?: string;
  image?: string | string[];
  offers?: JsonLdOffer;
};

const CATEGORY_URLS = (process.env.SCRAPE_CATEGORY_URLS ?? 'https://tap.az/elanlar/elektronika')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const MAX_PAGES_PER_CATEGORY = Number(process.env.SCRAPE_MAX_PAGES ?? '1');
const MAX_LISTINGS_PER_CATEGORY = Number(process.env.SCRAPE_MAX_LISTINGS ?? '40');
const PAGE_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? '1500');
const DETAIL_DELAY_MS = Number(process.env.SCRAPE_DETAIL_DELAY_MS ?? '1200');
const OUTPUT_DIR = process.env.SCRAPE_OUTPUT_DIR ?? path.join(process.cwd(), 'data', 'snapshots');
const HEADLESS = (process.env.SCRAPE_HEADLESS ?? 'true').toLowerCase() !== 'false';
const CF_CLEARANCE = process.env.SCRAPE_CF_CLEARANCE;
const CF_DOMAIN = process.env.SCRAPE_CF_DOMAIN ?? '.tap.az';

const EXCLUDED_PATH_SNIPPETS = ['/elanlar/is-elanlari'];
const CARD_SELECTOR = '.products-i, [data-testid="product-card"]';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureDir = async (targetDir: string) => {
  await fs.mkdir(targetDir, { recursive: true });
};

const parseCategoryFromUrl = (url: string) => {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean);
    const [, categorySlug, subcategorySlug] = segments;
    const tapId = segments.at(-1) ?? '';
    return { categorySlug, subcategorySlug, tapId };
  } catch {
    return { categorySlug: undefined, subcategorySlug: undefined, tapId: undefined };
  }
};

type GotoStrategy = { waitUntil: 'networkidle' | 'domcontentloaded'; timeout: number };

const navigateToCategoryPage = async (page: Page, url: string) => {
  const strategies: GotoStrategy[] = [
    { waitUntil: 'networkidle', timeout: 60_000 },
    { waitUntil: 'domcontentloaded', timeout: 60_000 }
  ];

  let lastError: unknown;

  for (const options of strategies) {
    try {
      await page.goto(url, options);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(2000);
    }
  }

  throw lastError;
};

const scrapeCategoryPage = async (page: Page, categoryUrl: string, pageNumber: number) => {
  const url = pageNumber > 1 ? `${categoryUrl}?page=${pageNumber}` : categoryUrl;
  await navigateToCategoryPage(page, url);
  try {
    await page.waitForSelector(CARD_SELECTOR, { timeout: 45_000 });
  } catch (error) {
    const html = await page.content();
    console.warn(
      `⚠️  ${categoryUrl} selector gözləmə zamanı tapılmadı. Cari URL: ${page.url()} · HTML sətir uzunluğu: ${html.length}`
    );
    console.warn(html.slice(0, 1000));
    throw error;
  }

  const listings = await page.$$eval(CARD_SELECTOR, (cards) =>
    cards
      .map((card) => {
        const bookmarkEl =
          card.querySelector<HTMLElement>('.product-bookmarks__link') ??
          card.querySelector<HTMLElement>('[data-ad-id]');
        const link =
          card.querySelector<HTMLAnchorElement>('.products-link') ??
          card.querySelector<HTMLAnchorElement>('a[href*="/elanlar/"]');
        const href = link?.href;
        const tapFromHref = href?.match(/(\d+)(?:\/)?$/)?.[1];
        const tapId = bookmarkEl?.dataset?.adId ?? bookmarkEl?.getAttribute('data-ad-id') ?? tapFromHref ?? undefined;
        if (!tapId || !href || !href.includes('/elanlar/')) {
          return null;
        }
        const priceNode =
          card.querySelector<HTMLElement>('.price-val') ??
          card.querySelector<HTMLElement>('[data-testid="price"]') ??
          card.querySelector<HTMLElement>('[itemprop="price"]');
        const currencyNode =
          card.querySelector<HTMLElement>('.price-cur') ??
          card.querySelector<HTMLElement>('[data-testid="currency"]') ??
          card.querySelector<HTMLElement>('[itemprop="priceCurrency"]');
        const titleNode =
          card.querySelector<HTMLElement>('.products-name') ??
          card.querySelector<HTMLElement>('[data-testid="product-title"]');
        const locationNode =
          card.querySelector<HTMLElement>('.products-created') ??
          card.querySelector<HTMLElement>('[data-testid="location"]');
        const imageNode = card.querySelector<HTMLImageElement>('img');

        return {
          tapId,
          title: titleNode?.textContent?.trim() ?? 'Əlaqədar elan',
          price: priceNode ? Number(priceNode.textContent?.replace(/\s+/g, '') ?? '') : undefined,
          currency: currencyNode?.textContent?.trim(),
          location: locationNode?.textContent?.trim() ?? undefined,
          url: href,
          imageUrl: imageNode?.src
        };
      })
      .filter(Boolean)
  );

  if (listings.length === 0) {
    const pageHtml = await page.content();
    console.warn(
      `⚠️  ${categoryUrl} üçün məhsul kartı tapılmadı. Cari URL: ${page.url()} · HTML sətir uzunluğu: ${pageHtml.length}`
    );
    console.warn(pageHtml.slice(0, 500));
  }

  return listings as BaseListingCard[];
};

const scrapeListingDetail = async (page: Page, url: string): Promise<ListingDetail | null> => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.product-info', { timeout: 12_000 });

  const detail = await page.evaluate(() => {
    const statsTexts = Array.from(document.querySelectorAll<HTMLElement>('.product-info__statistics__i-text')).map((node) =>
      node.textContent?.trim()
    );
    const viewStat = statsTexts.find((text) => text?.includes('Baxışların sayı'));
    const favoritesStat = statsTexts.find((text) => text?.includes('Seçilmiş'));

    const jsonLdScripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
    let productData: JsonLdProduct | undefined;
    for (const script of jsonLdScripts) {
      try {
        const parsed = JSON.parse(script.textContent ?? '{}') as JsonLdProduct;
        if (parsed['@type'] === 'Product') {
          productData = parsed;
          break;
        }
      } catch {
        // ignore parsing errors
      }
    }

    const priceAttr = document.querySelector<HTMLElement>('[itemprop="price"]')?.getAttribute('content');
    const currencyAttr = document.querySelector<HTMLElement>('[itemprop="priceCurrency"]')?.getAttribute('content');
    const description =
      document.querySelector<HTMLElement>('.product-description')?.textContent?.trim() ??
      productData?.description;

    const sellerName =
      document.querySelector<HTMLElement>('.product-info__shop-name')?.textContent?.trim() ??
      productData?.offers?.seller?.name;

    const hasShopBadge = Boolean(document.querySelector('.product-info__shop'));
    const conditionLabel = document.querySelector<HTMLElement>('.product-info__stats')?.textContent?.trim();
    const isNew = conditionLabel?.toLocaleLowerCase('az').includes('yeni');
    const sellerType: 'store' | 'individual' = hasShopBadge ? 'store' : 'individual';

    const postedAtISO =
      productData?.offers?.availabilityStarts ??
      document.querySelector<HTMLMetaElement>('meta[property="og:updated_time"]')?.content;

    const primaryImage =
      (Array.isArray(productData?.image) ? productData?.image[0] : productData?.image) ??
      document.querySelector<HTMLImageElement>('.product-gallery img, .product-image img')?.src ??
      document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ??
      undefined;

    return {
      description,
      sellerName,
      sellerType,
      postedAtText: statsTexts?.[0],
      postedAtISO,
      conditionLabel,
      isNew,
      viewCount: viewStat ? Number(viewStat.replace(/[^\d]/g, '')) : undefined,
      favoritesCount: favoritesStat ? Number(favoritesStat.replace(/[^\d]/g, '')) : undefined,
      price: priceAttr ? Number(priceAttr) : undefined,
      currency: currencyAttr ?? productData?.offers?.priceCurrency ?? 'AZN',
      imageUrl: primaryImage,
      jsonLd: productData as Record<string, unknown> | undefined
    };
  });

  return detail;
};

const scrapeCategory = async (context: BrowserContext, categoryUrl: string) => {
  const page = await context.newPage();
  try {
    await navigateToCategoryPage(page, 'https://tap.az/');
    await page.waitForTimeout(2000);
  } catch {
    // warmup failures shouldn't block the rest
  }
  const aggregated: BaseListingCard[] = [];

  for (let currentPage = 1; currentPage <= MAX_PAGES_PER_CATEGORY; currentPage += 1) {
    try {
      const cards = await scrapeCategoryPage(page, categoryUrl, currentPage);
      const filtered = cards.filter((card) => card.tapId && !EXCLUDED_PATH_SNIPPETS.some((snippet) => card.url.includes(snippet)));

      for (const card of filtered) {
        const { categorySlug, subcategorySlug } = parseCategoryFromUrl(card.url);
        card.categorySlug = categorySlug;
        card.subcategorySlug = subcategorySlug;
      }

      aggregated.push(...filtered);
      if (filtered.length === 0 || aggregated.length >= MAX_LISTINGS_PER_CATEGORY) {
        break;
      }
      await sleep(PAGE_DELAY_MS);
    } catch (error) {
      console.warn(`⚠️  ${categoryUrl} səhifə ${currentPage} oxunmadı:`, (error as Error).message);
      break;
    }
  }

  await page.close();
  return aggregated.slice(0, MAX_LISTINGS_PER_CATEGORY);
};

const enrichListings = async (
  context: BrowserContext,
  listings: BaseListingCard[],
  onProgress?: (processed: number, total: number, listing: BaseListingCard) => void
): Promise<ScrapedListing[]> => {
  const page = await context.newPage();
  const enriched: ScrapedListing[] = [];

  for (const listing of listings) {
    try {
      const detail = await scrapeListingDetail(page, listing.url);
      if (!detail) {
        continue;
      }

      const record: ScrapedListing = {
        ...listing,
        description: detail.description,
        sellerName: detail.sellerName,
        sellerType: detail.sellerType,
        postedAtText: detail.postedAtText,
        postedAtISO: detail.postedAtISO,
        conditionLabel: detail.conditionLabel,
        viewCount: detail.viewCount,
        favoritesCount: detail.favoritesCount,
        isNew: detail.isNew ?? listing.title.toLocaleLowerCase('az').includes('yeni'),
        price: detail.price ?? listing.price,
        currency: detail.currency ?? listing.currency,
        imageUrl: detail.imageUrl ?? listing.imageUrl,
        fetchedAt: new Date().toISOString(),
        raw: detail
      };

      enriched.push(record);
      onProgress?.(enriched.length, listings.length, listing);
      await sleep(DETAIL_DELAY_MS);
    } catch (error) {
      console.warn(`⚠️  Elan ${listing.tapId} oxunmadı:`, (error as Error).message);
    }
  }

  await page.close();
  return enriched;
};

const writeSnapshot = async (records: ScrapedListing[]) => {
  await ensureDir(OUTPUT_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(OUTPUT_DIR, `tapaz-live-${timestamp}.json`);
  const payload = {
    scrapedAt: new Date().toISOString(),
    categoryUrls: CATEGORY_URLS,
    total: records.length,
    items: records
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅  ${records.length} elan ${filePath} faylına yazıldı.`);
  return filePath;
};

const run = async () => {
  if (CATEGORY_URLS.length === 0) {
    console.error('Heç bir kateqoriya URL-i təyin edilməyib. SCRAPE_CATEGORY_URLS mühit dəyişənini yoxlayın.');
    process.exitCode = 1;
    return;
  }

  console.log('▶️  Tap.az Playwright toplayıcısı başlayır...');
  console.log(`   Kateqoriyalar: ${CATEGORY_URLS.join(', ')}`);
  console.log(`   Səhifə limiti: ${MAX_PAGES_PER_CATEGORY}, elan limiti: ${MAX_LISTINGS_PER_CATEGORY}`);
  reportProgress({
    phase: 'initializing',
    processed: 0,
    total: CATEGORY_URLS.length,
    percent: 0,
    message: 'Brauzer işə salınır'
  });

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent:
      process.env.SCRAPE_USER_AGENT ??
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'az-AZ',
    timezoneId: 'Asia/Baku',
    permissions: ['geolocation'],
    geolocation: { latitude: 40.4093, longitude: 49.8671 },
    extraHTTPHeaders: {
      'Accept-Language': 'az-AZ,az;q=0.9,tr;q=0.8,en;q=0.7'
    }
  });

  await context.addInitScript(() => {
    const globalObj: typeof window & { chrome?: unknown } = globalThis as never;
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    globalObj.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Linux x86_64'
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['az-AZ', 'az']
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4]
    });
  });

  if (CF_CLEARANCE) {
    await context.addCookies([
      {
        name: 'cf_clearance',
        value: CF_CLEARANCE,
        domain: CF_DOMAIN,
        path: '/',
        secure: true,
        httpOnly: false
      }
    ]);
  }

  try {
    const categoryCards: BaseListingCard[] = [];

  for (const [index, categoryUrl] of CATEGORY_URLS.entries()) {
    console.log(`\n📂 Kateqoriya: ${categoryUrl}`);
      const cards = await scrapeCategory(context, categoryUrl);
      console.log(`   ${cards.length} kart oxundu.`);
      categoryCards.push(...cards);
      reportProgress({
        phase: 'categories',
        processed: index + 1,
        total: CATEGORY_URLS.length,
        percent: Math.min(100, ((index + 1) / Math.max(1, CATEGORY_URLS.length)) * 100),
        message: `Kateqoriya ${index + 1}/${CATEGORY_URLS.length} tamamlandı`,
        items: cards.length
      });
    }

    const uniqueById = new Map<string, BaseListingCard>();
    for (const card of categoryCards) {
      uniqueById.set(card.tapId, card);
    }

    const uniqueCards = Array.from(uniqueById.values());
    console.log(`\nℹ️  Ümumi unikall elanlar: ${uniqueCards.length}`);
    reportProgress({
      phase: 'details',
      processed: 0,
      total: uniqueCards.length || 1,
      percent: 0,
      message: `Detallara başlanır (${uniqueCards.length} elan)`
    });

    const detailedRecords = await enrichListings(context, uniqueCards, (processed, total) => {
      reportProgress({
        phase: 'details',
        processed,
        total: total || 1,
        percent: Math.min(100, (processed / Math.max(1, total)) * 100),
        message: `Detallı oxunan elanlar ${processed}/${total}`
      });
    });
    console.log(`   Detallı oxunan elanlar: ${detailedRecords.length}`);

    reportProgress({
      phase: 'saving',
      processed: 0,
      total: 1,
      percent: 80,
      message: 'Snapshot yazılır'
    });
    const snapshotPath = await writeSnapshot(detailedRecords);
    reportProgress({
      phase: 'done',
      processed: 1,
      total: 1,
      percent: 100,
      message: 'Toplayıcı tamamlandı',
      outputPath: snapshotPath
    });
    console.log('🏁 Toplayıcı tamamlandı.');
  } finally {
    await context.close();
    await browser.close();
  }
};

run().catch((error) => {
  console.error('❌  Toplayıcıda gözlənilməyən xəta:', error);
  process.exitCode = 1;
});
