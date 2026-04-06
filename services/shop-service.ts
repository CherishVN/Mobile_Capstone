import { api } from '@/lib/api-client'
import { ShopPublicDetailResponse } from '@/types/shop'
import { ProductsResponse } from '@/types/product'

export const shopService = {
  getShopBySlug: (slug: string) =>
    api.get<ShopPublicDetailResponse>(`/api/shops/${encodeURIComponent(slug)}`),

  getShopProducts: (
    shopId: string,
    params: { page?: number; pageSize?: number; sortBy?: string } = {}
  ) => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.set('page', String(params.page))
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.sortBy) queryParams.set('sortBy', params.sortBy)
    const q = queryParams.toString()
    return api.get<ProductsResponse>(
      `/api/shops/${shopId}/products${q ? `?${q}` : ''}`
    )
  },

  followShop: (shopId: string) =>
    api.post<{ success: boolean; message?: string }>(`/api/shops/${shopId}/follow`),

  unfollowShop: (shopId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/api/shops/${shopId}/follow`),
}
