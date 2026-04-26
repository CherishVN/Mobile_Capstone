export interface ProductReview {
  id: string
  productId: string
  userId: string
  userName?: string | null
  rating: number
  comment?: string | null
  createdAt: string
  imageUrls: string[]
  /** Phản hồi từ người bán (khớp BE ProductReviewDto.SellerReply) */
  sellerReply?: string | null
}

export interface ProductReviewStatsDto {
  total: number
  count5: number
  count4: number
  count3: number
  count2: number
  count1: number
  withComment: number
  withImage: number
}

export interface ProductReviewStatsResponse {
  success: boolean
  data: ProductReviewStatsDto
}

export interface ProductReviewListResponse {
  success: boolean
  message?: string
  reviews: ProductReview[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CreateProductReviewRequest {
  orderId: string
  productId: string
  rating: number
  comment?: string
  imageUrls?: string[]
}

export interface ShopReview {
  id: string
  shopId: string
  userId: string
  userName?: string | null
  rating: number
  title?: string | null
  content?: string | null
  createdAt: string
}

export interface CreateShopReviewRequest {
  shopId: string
  orderId: string
  rating: number
  title?: string
  content?: string
}

export interface ShopReviewListResponse {
  success: boolean
  message?: string
  reviews: ShopReview[]
  totalCount: number
  page: number
  pageSize: number
  averageRating: number
}
