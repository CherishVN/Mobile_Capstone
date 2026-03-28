export interface Shop {
  id: string
  slug: string
  name: string
  description: string | null
  logo: string | null
  coverImage: string | null
  address: string | null
  phone: string | null
  email: string | null
  isActive: boolean
  totalProducts: number
  totalSold: number
  averageRating: number
  createdAt: string
}

export interface ShopDetailResponse {
  success: boolean
  message?: string
  data?: Shop
}
