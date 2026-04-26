import { api } from '@/lib/api-client'
import type {
  ProductReview,
  ProductReviewListResponse,
  ProductReviewStatsResponse,
  ShopReviewListResponse,
  CreateShopReviewRequest,
} from '@/types/review'

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
  getProductReviewStats: (productId: string) =>
    api.get<ProductReviewStatsResponse>(`/api/reviews/products/${productId}/stats`),

  getProductReviews: (
    productId: string,
    params: {
      page?: number
      pageSize?: number
      sortBy?: 'newest' | 'rating' | 'rating_asc' | string
      rating?: number
      hasComment?: boolean
      hasImage?: boolean
    } = {}
  ) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    if (params.sortBy) q.set('sortBy', params.sortBy)
    if (params.rating !== undefined && params.rating >= 1 && params.rating <= 5) {
      q.set('rating', String(params.rating))
    }
    if (params.hasComment === true) q.set('hasComment', 'true')
    if (params.hasImage === true) q.set('hasImage', 'true')
    const qs = q.toString()
    return api.get<ProductReviewListResponse>(
      `/api/reviews/products/${productId}${qs ? `?${qs}` : ''}`
    )
  },

  createProductReview: (data: CreateProductReviewRequest) =>
    api.post<{ success: boolean; message?: string; data?: ProductReview }>(
      '/api/reviews/products',
      {
        orderId: data.orderId,
        productId: data.productId,
        rating: data.rating,
        comment: data.comment ?? undefined,
        imageUrls: data.imageUrls?.length ? data.imageUrls : undefined,
      }
    ),

  getShopReviews: (
    shopId: string,
    params: { page?: number; pageSize?: number; sortBy?: string } = {}
  ) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    if (params.sortBy) q.set('sortBy', params.sortBy)
    const qs = q.toString()
    return api.get<ShopReviewListResponse>(
      `/api/reviews/shops/${shopId}${qs ? `?${qs}` : ''}`
    )
  },

  createShopReview: (data: CreateShopReviewRequest) =>
    api.post<{ success: boolean; message?: string }>('/api/reviews/shops', {
      shopId: data.shopId,
      orderId: data.orderId,
      rating: data.rating,
      title: data.title?.trim() || undefined,
      content: data.content?.trim() || undefined,
    }),
}
