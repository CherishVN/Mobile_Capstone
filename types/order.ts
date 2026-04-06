/** Khớp backend OrderStatus (short) */
export const OrderStatus = {
  PendingPayment: 0,
  PendingConfirmation: 1,
  Confirmed: 2,
  Processing: 3,
  Shipping: 4,
  Delivered: 5,
  Completed: 6,
  Cancelled: 7,
  Refunded: 8,
} as const

export type OrderStatusValue = (typeof OrderStatus)[keyof typeof OrderStatus]

const LABELS_VI: Record<number, string> = {
  [OrderStatus.PendingPayment]: 'Chờ thanh toán',
  [OrderStatus.PendingConfirmation]: 'Chờ xác nhận',
  [OrderStatus.Confirmed]: 'Đã xác nhận',
  [OrderStatus.Processing]: 'Đang chuẩn bị',
  [OrderStatus.Shipping]: 'Đang giao hàng',
  [OrderStatus.Delivered]: 'Đã giao hàng',
  [OrderStatus.Completed]: 'Hoàn thành',
  [OrderStatus.Cancelled]: 'Đã hủy',
  [OrderStatus.Refunded]: 'Hoàn tiền',
}

export function getOrderStatusLabelVi(status: number): string {
  return LABELS_VI[status] ?? 'Không xác định'
}

export const OrderStatusColors: Record<number, string> = {
  [OrderStatus.PendingPayment]: '#FF9500',
  [OrderStatus.PendingConfirmation]: '#FF9500',
  [OrderStatus.Confirmed]: '#007AFF',
  [OrderStatus.Processing]: '#5856D6',
  [OrderStatus.Shipping]: '#AF52DE',
  [OrderStatus.Delivered]: '#34C759',
  [OrderStatus.Completed]: '#34C759',
  [OrderStatus.Cancelled]: '#FF3B30',
  [OrderStatus.Refunded]: '#8E8E93',
}

export function getOrderStatusColor(status: number): string {
  return OrderStatusColors[status] ?? '#8E8E93'
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
  hasReviewedByUser?: boolean
}

export interface Order {
  id: string
  orderCode: string
  shopId: string
  shopSlug: string
  shopName: string
  status: number
  statusName: string
  subtotal: number
  shippingFee: number
  total: number
  items: OrderItem[]
  shippingAddress: string
  createdAt: string
  updatedAt?: string
}
