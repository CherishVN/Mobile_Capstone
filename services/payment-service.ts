import { api } from '@/lib/api-client'

export interface CreatePaymentResult {
  success: boolean
  message?: string
  paymentUrl?: string
  paymentId?: string
}

export const paymentService = {
  createVNPay: (orderId: string) =>
    api.post<CreatePaymentResult>('/api/payments/vnpay/create', { orderId }),

  createMoMo: (orderId: string) =>
    api.post<CreatePaymentResult>('/api/payments/momo/create', { orderId }),
}
