import { api } from '@/lib/api-client'
import { ShopDetailResponse } from '@/types/shop'

export const shopService = {
  getShopBySlug: (slug: string) =>
    api.get<ShopDetailResponse>(`/api/shops/${slug}`),

  getShopById: (shopId: string) =>
    api.get<ShopDetailResponse>(`/api/shops/${shopId}`),
}
