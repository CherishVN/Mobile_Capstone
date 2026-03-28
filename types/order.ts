export const OrderStatus = {
  Pending: 0,
  Confirmed: 1,
  Shipping: 2,
  Delivered: 3,
  Cancelled: 4,
  Refunded: 5,
} as const

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus]

export const OrderStatusLabels: Record<OrderStatusValue, string> = {
  [OrderStatus.Pending]: "Chờ xác nhận",
  [OrderStatus.Confirmed]: "Đã xác nhận",
  [OrderStatus.Shipping]: "Đang giao",
  [OrderStatus.Delivered]: "Đã giao",
  [OrderStatus.Cancelled]: "Đã hủy",
  [OrderStatus.Refunded]: "Hoàn tiền",
}

export const OrderStatusColors: Record<OrderStatusValue, string> = {
  [OrderStatus.Pending]: "#FFA500",
  [OrderStatus.Confirmed]: "#4169E1",
  [OrderStatus.Shipping]: "#9370DB",
  [OrderStatus.Delivered]: "#32CD32",
  [OrderStatus.Cancelled]: "#DC143C",
  [OrderStatus.Refunded]: "#808080",
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage?: string
  variantId?: string
  variantName?: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface Order {
  id: string
  orderCode: string
  shopId: string
  shopName: string
  status: OrderStatusValue
  statusName: string
  subtotal: number
  shippingFee: number
  total: number
  items: OrderItem[]
  shippingAddress: string
  createdAt: string
  updatedAt: string
}
