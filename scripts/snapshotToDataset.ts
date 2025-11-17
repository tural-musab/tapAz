import fs from 'node:fs/promises';
import path from 'node:path';

interface SnapshotListing {
  tapId?: string;
  title?: string;
  price?: number;
  currency?: string;
  location?: string;
  url?: string;
  imageUrl?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  sellerName?: string;
  sellerType?: 'store' | 'individual';
  description?: string;
  postedAtISO?: string;
  viewCount?: number;
  favoriteCount?: number;
  conditionLabel?: string;
  isNew?: boolean;
  raw?: {
    description?: string;
    sellerName?: string;
    favoritesCount?: number;
    postedAtISO?: string;
    imageUrl?: string;
    jsonLd?: Record<string, unknown>;
  };
}

interface SnapshotFile {
  scrapedAt: string;
  total: number;
  items: SnapshotListing[];
}

const ROOT_DIR = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT_DIR, 'data', 'snapshots');
const TARGET_FILE = path.join(ROOT_DIR, 'src', 'data', 'listings.json');

const CATEGORY_DEFAULT = { categoryId: 'electronics', subcategoryId: 'digər-elektronika' };

const SUBCATEGORY_MAP: Record<string, { categoryId: string; subcategoryId: string }> = {
  telefonlar: { categoryId: 'electronics', subcategoryId: 'telefonlar' },
  plansetler: { categoryId: 'electronics', subcategoryId: 'plansetler' },
  komputerler: { categoryId: 'electronics', subcategoryId: 'komputerler' },
  noutbuklar: { categoryId: 'electronics', subcategoryId: 'noutbuklar' },
  'komputer-aksesuarlari': { categoryId: 'electronics', subcategoryId: 'komputer-aksesuarlari' },
  'komputer-avadanliqi': { categoryId: 'electronics', subcategoryId: 'komputer-avadanliqi' },
  'smart-saat-ve-qolbaqlar': { categoryId: 'electronics', subcategoryId: 'smart-saat-ve-qolbaqlar' },
  'nomreler-ve-sim-kartlar': { categoryId: 'electronics', subcategoryId: 'nomreler-ve-sim-kartlar' },
  'audio-video': { categoryId: 'electronics', subcategoryId: 'audio-video' },
  'fotoaparatlar-ve-linzalar': { categoryId: 'electronics', subcategoryId: 'fotoaparatlar-ve-linzalar' },
  'oyunlar-ve-programlar': { categoryId: 'electronics', subcategoryId: 'oyunlar-ve-programlar' },
  'televizor-ve-aksesuarlar': { categoryId: 'electronics', subcategoryId: 'televizor-ve-aksesuarlar' },
  'ofis-avadanliqi': { categoryId: 'electronics', subcategoryId: 'ofis-avadanliqi' }
};

const sanitizeText = (value?: string | null) => {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
};

const mapSubcategory = (slug?: string) => SUBCATEGORY_MAP[slug ?? ''] ?? CATEGORY_DEFAULT;

const parseCity = (location?: string) => {
  if (!location) return 'Bakı';
  const [city] = location.split(',');
  return sanitizeText(city) || 'Bakı';
};

const detectCondition = (item: SnapshotListing) => {
  if (typeof item.isNew === 'boolean') return item.isNew;
  const label = sanitizeText(item.conditionLabel).toLocaleLowerCase('az');
  return label.includes('yeni');
};

const resolveDescription = (item: SnapshotListing) => {
  const fromFields = sanitizeText(item.description);
  if (fromFields) return fromFields;
  const rawDesc = sanitizeText(item.raw?.description as string | undefined);
  if (rawDesc) return rawDesc;
  const jsonLdDesc = sanitizeText(item.raw?.jsonLd?.['description'] as string | undefined);
  if (jsonLdDesc) return jsonLdDesc;
  return 'Elan təsviri təqdim edilməyib.';
};

const resolveSellerName = (item: SnapshotListing) => {
  const fromFields = sanitizeText(item.sellerName);
  if (fromFields) return fromFields;
  const rawSeller = sanitizeText(item.raw?.sellerName);
  if (rawSeller) return rawSeller;
  return item.sellerType === 'store' ? 'Tap.az mağazası' : 'Fərdi satıcı';
};

const resolveImage = (item: SnapshotListing) => item.imageUrl ?? (item.raw?.imageUrl as string | undefined);

const buildListingRecord = (item: SnapshotListing, index: number) => {
  const ids = mapSubcategory(item.subcategorySlug);
  return {
    id: `LIVE-${item.tapId ?? index + 1}`,
    tapId: item.tapId ?? `unknown-${index + 1}`,
    title: sanitizeText(item.title) || 'Adsız elan',
    description: resolveDescription(item),
    categoryId: ids.categoryId,
    subcategoryId: ids.subcategoryId,
    isNew: detectCondition(item),
    price: item.price ?? 0,
    currency: 'AZN',
    sellerType: item.sellerType ?? 'individual',
    sellerName: resolveSellerName(item),
    city: parseCity(item.location),
    postedAt: item.postedAtISO ?? new Date().toISOString(),
    viewCount: item.viewCount ?? 0,
    favoriteCount: item.raw?.favoritesCount ?? 0,
    listingUrl: item.url ?? '',
    imageUrl: resolveImage(item)
  };
};

const getLatestSnapshotPath = async () => {
  const entries = await fs.readdir(SNAPSHOT_DIR);
  const files = await Promise.all(
    entries
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => {
        const filePath = path.join(SNAPSHOT_DIR, name);
        const stat = await fs.stat(filePath);
        return { filePath, mtime: stat.mtimeMs };
      })
  );

  if (files.length === 0) {
    throw new Error('data/snapshots qovluğunda heç bir JSON snapshot tapılmadı.');
  }

  return files.sort((a, b) => b.mtime - a.mtime)[0].filePath;
};

const run = async () => {
  const latestSnapshot = await getLatestSnapshotPath();
  console.log(`📄 Son snapshot: ${path.basename(latestSnapshot)}`);

  const snapshotRaw = await fs.readFile(latestSnapshot, 'utf8');
  const snapshot: SnapshotFile = JSON.parse(snapshotRaw);

  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    throw new Error('Snapshot faylı boşdur və ya yanlış formatdadır.');
  }

  const records = snapshot.items.map(buildListingRecord);
  await fs.writeFile(TARGET_FILE, JSON.stringify(records, null, 2), 'utf8');

  console.log(`✅ ${records.length} elan src/data/listings.json faylına köçürüldü.`);
};

run().catch((error) => {
  console.error('❌ Snapshot sinxronizasiya xətası:', error);
  process.exitCode = 1;
});

