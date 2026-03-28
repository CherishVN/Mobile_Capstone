export interface CartItem {
  id: string
  productId: string
  productName: string
  productImage?: string
  variantId?: string
  variantName?: string
  unitPrice: number
  quantity: number
  lineTotal: number
  stockAvailable: number
}

export interface Cart {
  id: string
  status: number
  items: CartItem[]
  subtotal: number
  totalItems: number
  updatedAt: string
}

export interface AddCartItemRequest {
  productId: string
  variantId?: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}
