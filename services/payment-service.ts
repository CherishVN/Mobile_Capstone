import { CONFIG } from '@/config'
import { api } from '@/lib/api-client'

/** Trùng host với API client (emulator → 10.0.2.2) để WebView không gọi localhost của emulator. */
function getVnPayReturnUrlOverride(): string {
  const base = CONFIG.api.baseUrl.replace(/\/$/, '')
  return `${base}/api/payments/vnpay/return`
}

export interface CreatePaymentResult {
  success: boolean
  message?: string
  paymentUrl?: string
  paymentId?: string
}

export type VnPayClientReturnUrls = {
  clientReturnSuccessUrl: string
  clientReturnFailureUrl: string
}

export const paymentService = {
  createVNPay: (orderId: string, clientUrls?: VnPayClientReturnUrls) =>
    api.post<CreatePaymentResult>('/api/payments/vnpay/create', {
      orderId,
      vnPayReturnUrlOverride: getVnPayReturnUrlOverride(),
      ...clientUrls,
    }),

  createVNPayBatch: (orderIds: string[], clientUrls?: VnPayClientReturnUrls) =>
    api.post<CreatePaymentResult>('/api/payments/vnpay/create-batch', {
      orderIds,
      vnPayReturnUrlOverride: getVnPayReturnUrlOverride(),
      ...clientUrls,
    }),

  createMoMo: (orderId: string) =>
    api.post<CreatePaymentResult>('/api/payments/momo/create', { orderId }),
}
