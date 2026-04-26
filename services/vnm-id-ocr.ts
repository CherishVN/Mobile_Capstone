import { CONFIG } from '@/config'
import { getAccessToken } from '@/lib/supabase'

export type VnmIdOcrData = {
  type?: string | null
  typeNew?: string | null
  id?: string | null
  name?: string | null
  dob?: string | null
  sex?: string | null
  nationality?: string | null
  home?: string | null
  address?: string | null
  addressEntities?: {
    province?: string | null
    district?: string | null
    ward?: string | null
    street?: string | null
  } | null
  issueDate?: string | null
  issueLoc?: string | null
  doe?: string | null
  religion?: string | null
  ethnicity?: string | null
  features?: string | null
}

export type VnmIdOcrResponse = {
  success: boolean
  errorCode?: number
  message?: string | null
  data?: VnmIdOcrData | null
}

type ImagePayload = { uri: string; name: string; type: string }

/**
 * Gửi ảnh CCCD/CMND lên ECommerce API — FPT.AI, API key ở server.
 */
export async function recognizeVietnamIdCard(image: ImagePayload): Promise<VnmIdOcrResponse> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Vui lòng đăng nhập')
  }
  const formData = new FormData()
  formData.append('image', {
    uri: image.uri,
    name: image.name,
    type: image.type,
  } as unknown as Blob)

  const base = CONFIG.api.baseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/api/ocr/vnm-id-card`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const json = (await res.json().catch(() => ({}))) as VnmIdOcrResponse
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? res.statusText
    throw new Error(msg || 'Không đọc được thông tin')
  }
  return json
}
