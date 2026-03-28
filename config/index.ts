import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra || {}

export const CONFIG = {
  supabase: {
    url: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  api: {
    baseUrl: extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5153',
    aiUrl: extra.aiUrl || process.env.EXPO_PUBLIC_AI_URL || 'http://localhost:5001',
  },
}
