import { api } from '@/lib/api-client'
import type {
  ProductReview,
  ProductReviewListResponse,
  CreateProductReviewRequest,
  ShopReviewListResponse,
  CreateShopReviewRequest,
} from '@/types/review'

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

  createShopReview: (data: CreateShopReviewRequest) =>
    api.post<{ success: boolean; message?: string }>('/api/reviews/shops', {
      shopId: data.shopId,
      orderId: data.orderId,
      rating: data.rating,
      title: data.title?.trim() || undefined,
      content: data.content?.trim() || undefined,
    }),
}
