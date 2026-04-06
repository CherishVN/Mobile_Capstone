import Constants from 'expo-constants'
import { Platform } from 'react-native'

const extra = Constants.expoConfig?.extra || {}

/** Bỏ slash cuối để tránh lỗi nối path */
function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, '')
}

/**
 * Android Emulator: localhost/127.0.0.1 là chính emulator, không phải máy dev.
 * Map sang 10.0.2.2 = máy host (chỉ emulator; máy thật vẫn cần IP LAN trong .env).
 */
function normalizeDevHostUrl(url: string): string {
  const raw = stripTrailingSlash((url || '').trim())
  if (!raw) return raw
  try {
    const parsed = new URL(raw)
    const loopback =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (Platform.OS === 'android' && loopback && Constants.isDevice !== true) {
      parsed.hostname = '10.0.2.2'
      return stripTrailingSlash(parsed.toString())
    }
  } catch {
    /* giữ nguyên */
  }
  return raw
}

const rawBase =
  (extra.apiUrl as string) || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5153'
const rawAi =
  (extra.aiUrl as string) || process.env.EXPO_PUBLIC_AI_URL || 'http://localhost:5001'

export const CONFIG = {
  supabase: {
    url: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  api: {
    baseUrl: normalizeDevHostUrl(rawBase),
    aiUrl: normalizeDevHostUrl(rawAi),
  },
}
