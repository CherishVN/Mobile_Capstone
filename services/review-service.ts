import { api } from '@/lib/api-client'
import { ProductReviewListResponse } from '@/types/review'

export interface CreateProductReviewRequest {
  orderId: string
  productId: string
  rating: number
  comment?: string
  imageUrls?: string[]
}

export interface CreateProductReviewResponse {
  success: boolean
  message: string
  data?: any
}

export const reviewService = {
  getProductReviews: (
    productId: string,
    params: { page?: number; pageSize?: number; sortBy?: string } = {}
  ) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    if (params.sortBy) q.set('sortBy', params.sortBy)
    const qs = q.toString()
    return api.get<ProductReviewListResponse>(
      `/api/reviews/products/${productId}${qs ? `?${qs}` : ''}`
    )
  },

  createProductReview: (data: CreateProductReviewRequest) =>
    api.post<CreateProductReviewResponse>('/api/reviews/products', data),
}
