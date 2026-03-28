import { api } from '@/lib/api-client'
import { Order } from '@/types/order'
import { ApiResponse, PaginatedResponse } from '@/types/api'

export interface CheckoutRequest {
  cartId: string
  shippingAddressId: string
}

export interface CheckoutResponse {
  success: boolean
  message: string
  orderIds: string[]
  totalAmount: number
}

export const orderService = {
  getMyOrders: (params: { page?: number; pageSize?: number; status?: number } = {}) => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.set('page', String(params.page))
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.status !== undefined) queryParams.set('status', String(params.status))

    const query = queryParams.toString()
    return api.get<PaginatedResponse<Order>>(`/api/orders${query ? `?${query}` : ''}`)
  },

  getOrderById: (orderId: string) =>
    api.get<ApiResponse<Order>>(`/api/orders/${orderId}`),

  checkout: (data: CheckoutRequest) =>
    api.post<ApiResponse<CheckoutResponse>>('/api/cart/checkout', data),

  cancelOrder: (orderId: string) =>
    api.post<ApiResponse<null>>(`/api/orders/${orderId}/cancel`),
}
