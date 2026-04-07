import Constants from 'expo-constants'
import { Platform } from 'react-native'

const extra = Constants.expoConfig?.extra || {}

/** Bỏ slash cuối để tránh lỗi nối path */
function stripTrailingSlash(u: string) {
  return u.replace(/\/$/, '')
}

/**
 * Android Emulator: localhost/127.0.0.1 trỏ vào chính emulator, không phải máy host.
 * 10.0.2.2 = máy dev đang chạy emulator (BE lắng nghe 0.0.0.0 hoặc 127.0.0.1 trên PC).
 *
 * Nếu .env dùng IP LAN (vd. 192.168.x.x) mà emulator vẫn không gọi được BE cùng máy,
 * đặt EXPO_PUBLIC_ANDROID_EMULATOR_MAP_LAN_TO_HOST=1 để đổi host đó thành 10.0.2.2.
 */
function shouldMapLanToEmulatorHost(): boolean {
  const v = process.env.EXPO_PUBLIC_ANDROID_EMULATOR_MAP_LAN_TO_HOST
  return v === '1' || v === 'true'
}

function isPrivateLanHost(hostname: string): boolean {
  if (hostname === '10.0.2.2') return false
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
  return false
}

function normalizeDevHostUrl(url: string): string {
  const raw = stripTrailingSlash((url || '').trim())
  if (!raw) return raw
  try {
    const parsed = new URL(raw)
    const loopback =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    const androidEmulator = Platform.OS === 'android' && Constants.isDevice !== true
    if (androidEmulator && loopback) {
      parsed.hostname = '10.0.2.2'
      return stripTrailingSlash(parsed.toString())
    }
    if (
      androidEmulator &&
      shouldMapLanToEmulatorHost() &&
      isPrivateLanHost(parsed.hostname)
    ) {
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
