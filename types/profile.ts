import { UserProfile } from '@/types/user'

export type UserProfileResponse = UserProfile

export interface ShopDocumentInput {
  docType: string
  fileUrl: string
}

export interface RegisterSellerRequest {
  shopName: string
  shopDescription?: string | null
  phone: string
  addressLine: string
  wardCode: string
  districtId: number
  provinceId: number
  city: string
  businessLicenseNumber?: string | null
  taxCode?: string | null
  businessType: 'individual' | 'company' | 'household'
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  documents?: ShopDocumentInput[]
}
