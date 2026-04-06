/** Dữ liệu shop public từ GET /api/shops/{slug} */
export interface ShopPublicDto {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  coverUrl?: string | null
  productCount: number
  followerCount: number
  averageRating: number
  reviewCount: number
  createdAt: string
  isFollowing?: boolean
}

export interface ShopPublicDetailResponse {
  success: boolean
  message?: string
  shop?: ShopPublicDto
}

/** View model thống nhất cho màn Shop (map từ ShopPublicDto) */
export interface Shop {
  id: string
  slug: string
  name: string
  description: string | null
  logo: string | null
  coverImage: string | null
  productCount: number
  followerCount: number
  averageRating: number
  reviewCount: number
  createdAt: string
  /** Có khi gọi API kèm token */
  isFollowing?: boolean
}
