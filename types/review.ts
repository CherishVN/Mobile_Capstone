export interface ProductReview {
  id: string
  productId: string
  userId: string
  userName?: string | null
  rating: number
  comment?: string | null
  createdAt: string
  imageUrls: string[]
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
