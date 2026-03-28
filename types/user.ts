export interface UserProfile {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  role: string
  createdAt: string
  updatedAt: string
  shop: ShopInfo | null
}

export interface ShopInfo {
  shopId: string
  shopName: string
  shopSlug: string
  shopDescription: string | null
  shopLogo: string | null
}

export interface Address {
  id: string
  label: string | null
  fullName: string | null
  phone: string | null
  addressLine1: string
  addressLine2: string | null
  ward: string | null
  district: string | null
  city: string
  province: string | null
  postalCode: string | null
  country: string
  isDefault: boolean
  createdAt: string
}

export interface UpdateProfileRequest {
  fullName?: string | null
  phone?: string | null
}

export interface AddAddressRequest {
  label?: string
  fullName?: string
  phone?: string
  addressLine1: string
  addressLine2?: string
  ward?: string
  district?: string
  city: string
  province?: string
  postalCode?: string
  country?: string
  isDefault?: boolean
}
