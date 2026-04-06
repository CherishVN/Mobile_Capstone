import { Order, OrderItem, getOrderStatusLabelVi } from '@/types/order'

/** Payload từ API GET /api/orders (từng phần tử trong `orders`) */
export interface ApiCustomerOrderSummary {
  id: string
  shopId: string
  shopSlug?: string
  shopName: string
  subtotal?: number
  shippingFee?: number
  totalAmount: number
  status: number
  statusName?: string
  createdAt: string
  items?: ApiCustomerOrderItem[]
}

export interface ApiCustomerOrderItem {
  id: string
  productId: string
  productName: string
  variantName?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  thumbnailUrl?: string | null
  hasReviewedByUser?: boolean
}

/** Chi tiết đơn — thêm địa chỉ giao */
export interface ApiCustomerOrderDetail extends ApiCustomerOrderSummary {
  shipFullName?: string | null
  shipPhone?: string | null
  shipAddress?: string | null
  updatedAt?: string
}

export function formatOrderCode(id: string): string {
  const compact = id.replace(/-/g, '')
  return `#${compact.slice(0, 8).toUpperCase()}`
}

function mapOrderItem(i: ApiCustomerOrderItem): OrderItem {
  return {
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    productImage: i.thumbnailUrl || undefined,
    variantName: i.variantName || undefined,
    unitPrice: Number(i.unitPrice),
    quantity: i.quantity,
    lineTotal: Number(i.totalPrice),
    hasReviewedByUser: i.hasReviewedByUser,
  }
}

export function mapApiOrderSummaryToOrder(o: ApiCustomerOrderSummary): Order {
  const items = (o.items || []).map(mapOrderItem)
  const sumLines = items.reduce((s, it) => s + it.lineTotal, 0)
  const subtotal =
    o.subtotal !== undefined && o.subtotal !== null ? Number(o.subtotal) : sumLines
  const total = Number(o.totalAmount)
  const shippingFee =
    o.shippingFee !== undefined && o.shippingFee !== null
      ? Number(o.shippingFee)
      : Math.max(0, total - subtotal)

  return {
    id: o.id,
    orderCode: formatOrderCode(o.id),
    shopId: o.shopId,
    shopSlug: o.shopSlug || '',
    shopName: o.shopName,
    status: o.status,
    statusName: getOrderStatusLabelVi(o.status) || o.statusName || String(o.status),
    subtotal,
    shippingFee,
    total,
    items,
    shippingAddress: '',
    createdAt: o.createdAt,
  }
}

export function mapApiOrderDetailToOrder(o: ApiCustomerOrderDetail): Order {
  const base = mapApiOrderSummaryToOrder(o)
  const parts = [o.shipFullName, o.shipPhone, o.shipAddress].filter(Boolean)
  return {
    ...base,
    shippingAddress: parts.join('\n'),
    updatedAt: o.updatedAt,
  }
}
