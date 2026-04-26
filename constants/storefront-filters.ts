/** Khớp `sortBy` API storefront + FE (search/page) */
export type StorefrontSort =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'best_seller'

const SORT_VALUES: StorefrontSort[] = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'best_seller',
]

export function parseSortParam(raw: string | string[] | undefined | null): StorefrontSort | null {
  if (raw == null) return null
  const s = (Array.isArray(raw) ? raw[0] : raw).toString().trim().toLowerCase()
  if (!s) return null
  return (SORT_VALUES as string[]).includes(s) ? (s as StorefrontSort) : null
}

export const DEFAULT_PAGE_SIZE = 20

export const SORT_LABELS: Record<StorefrontSort, string> = {
  relevance: 'Liên quan',
  newest: 'Mới nhất',
  best_seller: 'Bán chạy',
  price_asc: 'Giá thấp',
  price_desc: 'Giá cao',
  rating: 'Đánh giá',
}
