import { api } from '@/lib/api-client'
import {
  mapApiOrderDetailToOrder,
  mapApiOrderSummaryToOrder,
  type ApiCustomerOrderDetail,
  type ApiCustomerOrderSummary,
} from '@/utils/order-mapper'

export interface CheckoutRequest {
  cartId: string
  shippingAddressId: string
}

/** Body từ POST /api/cart/checkout */
export interface CheckoutApiBody {
  success: boolean
  message?: string
  data?: {
    success: boolean
    message?: string
    orderIds: string[]
    totalAmount: number
  }
}

export interface CustomerOrderListApi {
  success: boolean
  message?: string
  orders: ApiCustomerOrderSummary[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CustomerOrderDetailApi {
  success: boolean
  message?: string
  order?: ApiCustomerOrderDetail
}

export const orderService = {
  getMyOrders: async (params: { page?: number; pageSize?: number; status?: number } = {}) => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.set('page', String(params.page))
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.status !== undefined) queryParams.set('status', String(params.status))

    const query = queryParams.toString()
    const res = await api.get<CustomerOrderListApi>(`/api/orders${query ? `?${query}` : ''}`)
    return {
      success: res.success,
      orders: (res.orders || []).map(mapApiOrderSummaryToOrder),
      totalCount: res.totalCount,
      page: res.page,
      pageSize: res.pageSize,
    }
  },

  getOrderById: async (orderId: string) => {
    const res = await api.get<CustomerOrderDetailApi>(`/api/orders/${orderId}`)
    return {
      success: res.success,
      order: res.order ? mapApiOrderDetailToOrder(res.order) : null,
      message: res.message,
    }
  },

  checkout: (data: CheckoutRequest) =>
    api.post<CheckoutApiBody>('/api/cart/checkout', {
      cartId: data.cartId,
      shippingAddressId: data.shippingAddressId,
    }),

  /** Chỉ đơn chờ thanh toán (0) — khớp backend cancel-pending */
  cancelPendingOrder: (orderId: string, reason?: string) =>
    api.post<{ success: boolean; message?: string }>(`/api/orders/${orderId}/cancel-pending`, reason ? { reason } : {}),

  /** Hủy đơn đã thanh toán (status 1,2,3) — BE tự hoàn tiền vào ví */
  cancelOrder: (orderId: string, reason?: string) =>
    api.post<{ success: boolean; message?: string }>(`/api/orders/${orderId}/cancel`, reason ? { reason } : {}),

  /** Xác nhận đã nhận hàng — đơn đang giao (Shipping) */
  confirmReceived: (orderId: string) =>
    api.post<{ success: boolean; message?: string }>(`/api/orders/${orderId}/confirm`),
}
