import { UserProfile } from '@/types/user'

export type UserProfileResponse = UserProfile

export interface ShopDocumentInput {
  docType: string
  fileUrl: string
}

/** Khớp BE /api/user/register-seller. Web: ảnh CCCD dùng OCR (FPT qua /api/ocr) điền form; gửi kèm thường chỉ GPKD/MST trong `documents` */
export interface SellerIdentityInfo {
  fullName: string
  idNumber?: string | null
  dateOfBirth?: string | null
  sex?: string | null
  nationality?: string | null
  homeTown?: string | null
  permanentAddress?: string | null
  addrProvince?: string | null
  addrDistrict?: string | null
  addrWard?: string | null
  addrStreet?: string | null
  dateOfExpiry?: string | null
  cardType?: string | null
  issueDate?: string | null
  issuePlace?: string | null
  religion?: string | null
  ethnicity?: string | null
  features?: string | null
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
  /** Bắt buộc (ít nhất fullName) — khớp /api/user/register-seller */
  identity: SellerIdentityInfo
  /** Như web: thường chỉ nộp GPKD / MST; ảnh CCCD dùng để OCR, không bắt buộc gửi URL trong `documents` */
  documents?: ShopDocumentInput[]
}
