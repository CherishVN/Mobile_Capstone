const BASE_URL = 'https://provinces.open-api.vn/api'

export interface Province {
  code: number
  name: string
}

export interface District {
  code: number
  name: string
}

export interface Ward {
  code: number
  name: string
}

interface ProvinceDetailResponse {
  code: number
  name: string
  districts: District[]
}

interface DistrictDetailResponse {
  code: number
  name: string
  wards: Ward[]
}

export const vietnamProvincesService = {
  getProvinces: async (): Promise<Province[]> => {
    const res = await fetch(`${BASE_URL}/p/`)
    if (!res.ok) throw new Error('Không thể tải danh sách tỉnh/thành phố')
    return res.json()
  },

  getDistricts: async (provinceCode: number): Promise<District[]> => {
    const res = await fetch(`${BASE_URL}/p/${provinceCode}?depth=2`)
    if (!res.ok) throw new Error('Không thể tải danh sách quận/huyện')
    const data: ProvinceDetailResponse = await res.json()
    return data.districts
  },

  getWards: async (districtCode: number): Promise<Ward[]> => {
    const res = await fetch(`${BASE_URL}/d/${districtCode}?depth=2`)
    if (!res.ok) throw new Error('Không thể tải danh sách phường/xã')
    const data: DistrictDetailResponse = await res.json()
    return data.wards
  },
}
