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
