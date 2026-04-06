import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { CONFIG } from '@/config'
import { getAccessToken } from './supabase'
import { ApiError } from '@/types/api'

const aiClient = axios.create({
  baseURL: CONFIG.api.aiUrl.replace(/\/$/, ''),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
})

aiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken()
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

aiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: (error.response?.data as any)?.message || error.message || 'AI không phản hồi',
      statusCode: error.response?.status,
    }
    return Promise.reject(apiError)
  }
)

export const aiApi = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    aiClient.get<T>(url, config).then((r) => r.data),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    aiClient.post<T>(url, data, config).then((r) => r.data),
}
