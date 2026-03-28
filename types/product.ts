export interface Product {
  id: string
  slug: string
  name: string
  shopId: string
  shopName: string
  shopSlug: string
  basePrice: number
  currency: string
  categoryId: number | null
  categoryName: string | null
  categorySlug: string | null
  imageUrls: string[]
  createdAt: string
  soldCount: number
}

export interface ProductVariant {
  id: string
  variantName: string
  attributes?: string | null
  price: number | null
  isActive: boolean
  stockQuantity: number
}

export interface ProductDetail extends Product {
  description: string | null
  averageRating: number
  reviewCount: number
  variants: ProductVariant[]
  totalStock: number
}

export interface ProductsResponse {
  success: boolean
  message?: string | null
  products: Product[]
  totalCount: number
  page: number
  pageSize: number
}

export interface ProductDetailResponse {
  success: boolean
  message?: string | null
  product?: ProductDetail
}
