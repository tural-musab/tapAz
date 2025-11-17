export type SellerType = 'store' | 'individual';

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  note?: string;
  subcategories: Subcategory[];
}

export interface Listing {
  id: string;
  tapId: string;
  title: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  isNew: boolean;
  price: number;
  currency: 'AZN';
  sellerType: SellerType;
  sellerName: string;
  sellerHandle?: string;
  city: string;
  postedAt: string;
  viewCount: number;
  favoriteCount: number;
  listingUrl: string;
  imageUrl?: string;
}

export interface ListingFilters {
  categoryId?: string;
  subcategoryId?: string;
  query?: string;
  isNew?: boolean | null;
  sellerType?: SellerType | 'all';
  minPrice?: number;
  maxPrice?: number;
  minViews?: number;
  maxViews?: number;
  city?: string;
}

export type SortField = 'views' | 'price' | 'date' | 'favorites';

export interface ListingQueryOptions {
  filters: ListingFilters;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface ListingQueryResult {
  items: Listing[];
  total: number;
  page: number;
  pageSize: number;
  stats: AggregateStats;
}

export interface AggregateStats {
  avgPrice: number;
  avgViews: number;
  totalListings: number;
  hottestListing?: Listing;
  freshestListing?: Listing;
  topStores: Array<{ sellerName: string; totalViews: number; listingCount: number }>;
}

