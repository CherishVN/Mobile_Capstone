import { api } from '@/lib/api-client'

export const favoriteService = {
  getFavoriteIds: () =>
    api.get<{ success: boolean; productIds: string[] }>('/api/favorites'),

  toggle: (productId: string) =>
    api.post<{ success: boolean; isFavorited: boolean }>(
      `/api/favorites/${productId}/toggle`
    ),

  check: (productId: string) =>
    api.get<{ success: boolean; isFavorited: boolean }>(`/api/favorites/${productId}`),
}
