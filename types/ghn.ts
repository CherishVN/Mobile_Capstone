// GHN (Giao Hàng Nhanh) — tối thiểu dùng cho tính phí checkout (khớp FE)

export interface GHNProvince {
  ProvinceID: number
  ProvinceName: string
  Code?: string
  NameExtension?: string[]
}

export interface GHNDistrict {
  DistrictID: number
  ProvinceID: number
  DistrictName: string
  Code?: string
  Type?: number
  NameExtension?: string[]
}

export interface GHNWard {
  WardCode: string
  DistrictID: number
  WardName: string
  NameExtension?: string[]
}

export interface GHNGetServiceRequest {
  shop_id: number
  from_district: number
  to_district: number
}

export interface GHNService {
  service_id: number
  service_type_id: number
}

export interface GHNCalculateFeeRequest {
  service_id?: number
  service_type_id?: number
  insurance_value?: number
  from_district_id?: number
  from_ward_code?: string
  to_district_id: number
  to_ward_code: string
  weight?: number
}

export interface GHNFeeData {
  total: number
}

export interface GHNLeadTimeRequest {
  from_district_id?: number
  from_ward_code?: string
  to_district_id: number
  to_ward_code: string
  service_id: number
}

export interface GHNLeadTimeData {
  leadtime: number
}
