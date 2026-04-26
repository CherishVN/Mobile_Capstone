import type {
  GHNCalculateFeeRequest,
  GHNDistrict,
  GHNFeeData,
  GHNGetServiceRequest,
  GHNLeadTimeData,
  GHNLeadTimeRequest,
  GHNProvince,
  GHNService,
  GHNWard,
} from '@/types/ghn'

const GHN_TOKEN = process.env.EXPO_PUBLIC_GHN_TOKEN ?? ''
const GHN_ORIGIN = 'https://dev-online-gateway.ghn.vn'
const MASTER_BASE = `${GHN_ORIGIN}/shiip/public-api/master-data`
const SHIP_BASE = `${GHN_ORIGIN}/shiip/public-api/v2/shipping-order`

type GHNResponse<T> = {
  code: number
  message: string
  data: T | null
  code_message?: string | string[]
  code_message_value?: string
}

function formatGhnErrorMessage(json: Record<string, unknown> | null, httpStatus: number): string {
  if (!json || typeof json !== 'object') {
    return `GHN: lỗi HTTP ${httpStatus}`
  }
  const code = typeof json.code === 'number' ? json.code : null
  const baseMsg = typeof json.message === 'string' && json.message.trim() ? json.message.trim() : ''
  let detail = ''
  const cmv = json.code_message_value
  const cm = json.code_message
  if (typeof cmv === 'string' && cmv.trim()) {
    detail = cmv.trim()
  } else if (typeof cm === 'string' && cm.trim()) {
    detail = cm.trim()
  } else if (Array.isArray(cm) && cm.length > 0 && typeof cm[0] === 'string') {
    detail = cm[0]
  } else {
    detail = baseMsg
  }
  if (!detail) detail = `HTTP ${httpStatus}`
  if (code != null && code !== 200) {
    return `[GHN #${code}] ${detail}`
  }
  if (baseMsg && baseMsg !== detail) {
    return `${detail} — ${baseMsg}`
  }
  return detail
}

function buildHeaders(shopId?: string | number): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Token: GHN_TOKEN,
  }
  if (shopId) headers.ShopId = String(shopId)
  return headers
}

export function isGhnTokenConfigured(): boolean {
  return Boolean(GHN_TOKEN.trim())
}

async function ghnFetch<T>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
  shopId?: string | number
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: buildHeaders(shopId),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const raw = await res.text()
  let json: GHNResponse<T> | null = null
  try {
    json = raw ? (JSON.parse(raw) as GHNResponse<T>) : null
  } catch {
    throw new Error(`GHN: phản hồi không phải JSON (HTTP ${res.status}). ${raw.slice(0, 200)}`)
  }
  if (!json) {
    throw new Error(`GHN: rỗng (HTTP ${res.status})`)
  }
  if (!res.ok || json.code !== 200) {
    throw new Error(formatGhnErrorMessage(json as unknown as Record<string, unknown>, res.status))
  }
  if (json.data === null || json.data === undefined) {
    return null as unknown as T
  }
  return json.data
}

const get = <T>(url: string, shopId?: string | number) => ghnFetch<T>(url, 'GET', undefined, shopId)
const post = <T>(url: string, body: unknown, shopId?: string | number) =>
  ghnFetch<T>(url, 'POST', body, shopId)

export const ghnService = {
  getProvinces: (): Promise<GHNProvince[]> =>
    get<GHNProvince[] | null>(`${MASTER_BASE}/province`).then((d) => (Array.isArray(d) ? d : [])),

  getDistricts: (provinceId: number): Promise<GHNDistrict[]> =>
    post<GHNDistrict[] | null>(`${MASTER_BASE}/district`, { province_id: provinceId }).then((d) =>
      Array.isArray(d) ? d : []
    ),

  getWards: (districtId: number): Promise<GHNWard[]> =>
    post<GHNWard[] | null>(`${MASTER_BASE}/ward`, { district_id: districtId }).then((d) =>
      Array.isArray(d) ? d : []
    ),

  getAvailableServices: (payload: GHNGetServiceRequest, shopId?: string | number): Promise<GHNService[]> =>
    post<GHNService[] | null>(`${SHIP_BASE}/available-services`, payload, shopId).then((d) =>
      Array.isArray(d) ? d : []
    ),

  calculateFee: (payload: GHNCalculateFeeRequest, shopId?: string | number): Promise<GHNFeeData> =>
    post<GHNFeeData>(`${SHIP_BASE}/fee`, payload, shopId),

  calculateLeadTime: (payload: GHNLeadTimeRequest, shopId?: string | number): Promise<GHNLeadTimeData> =>
    post<GHNLeadTimeData>(`${SHIP_BASE}/leadtime`, payload, shopId),
}
