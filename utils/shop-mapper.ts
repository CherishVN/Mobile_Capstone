import { Shop, ShopPublicDto } from '@/types/shop'

export function mapShopPublicToShop(s: ShopPublicDto): Shop {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description ?? null,
    logo: s.logoUrl ?? null,
    coverImage: s.coverUrl ?? null,
    productCount: s.productCount,
    followerCount: s.followerCount,
    averageRating: s.averageRating,
    reviewCount: s.reviewCount,
    createdAt: s.createdAt,
  }
}
