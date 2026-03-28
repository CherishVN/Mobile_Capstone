import { api } from '@/lib/api-client'
import {
  Cart,
  CartItem,
  AddCartItemRequest,
  UpdateCartItemRequest,
} from '@/types/cart'
import { ApiResponse } from '@/types/api'

export const cartService = {
  getMyCart: () => api.get<ApiResponse<Cart>>('/api/cart'),

  addItem: (data: AddCartItemRequest) =>
    api.post<ApiResponse<CartItem>>('/api/cart/items', data),

  updateItem: (itemId: string, data: UpdateCartItemRequest) =>
    api.put<ApiResponse<null>>(`/api/cart/items/${itemId}`, data),

  removeItem: (itemId: string) =>
    api.delete<ApiResponse<null>>(`/api/cart/items/${itemId}`),
}
