import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { paymentService } from '@/services/payment-service'

let pendingVnPayUrl: string | null = null

export function consumePendingVnPayUrl(): string | null {
  const u = pendingVnPayUrl
  pendingVnPayUrl = null
  return u
}

export function getVnPayClientReturnUrls() {
  return {
    clientReturnSuccessUrl: Linking.createURL('/payment/success'),
    clientReturnFailureUrl: Linking.createURL('/payment/failed'),
  }
}

export type VnPayInAppResult =
  | { kind: 'opened' }
  | { kind: 'error'; message?: string }

function isAppDeepLink(url: string): boolean {
  const u = url.trim().toLowerCase()
  return u.startsWith('ecommerce://') || u.startsWith('exp://') || u.startsWith('exps://')
}

/**
 * WebView gặp redirect 302 từ BE sang deep link — chặn load và điều hướng trong Expo Router.
 */
export function tryCompleteVnPayWebViewReturn(url: string): boolean {
  if (!url || !isAppDeepLink(url)) return false

  const lower = url.toLowerCase()
  if (lower.includes('payment/failed')) {
    let message = 'Thanh toán thất bại'
    try {
      const qi = url.indexOf('?')
      if (qi >= 0) {
        const m = new URLSearchParams(url.slice(qi + 1)).get('message')
        if (m) message = m
      }
    } catch {
      /* ignore */
    }
    router.replace({ pathname: '/payment/failed', params: { message } })
    return true
  }

  if (lower.includes('payment/success')) {
    let orderId = ''
    let amount = ''
    try {
      const qi = url.indexOf('?')
      if (qi >= 0) {
        const sp = new URLSearchParams(url.slice(qi + 1))
        orderId = sp.get('orderId') ?? ''
        amount = sp.get('amount') ?? ''
      }
    } catch {
      /* ignore */
    }
    router.replace({
      pathname: '/payment/success',
      params: { orderId, amount },
    })
    return true
  }

  return false
}

/**
 * Mở VNPay trong WebView full-screen (cùng process Expo Go), không dùng Chrome Custom Tab.
 */
export async function startVnPayInAppSession(orderId: string): Promise<VnPayInAppResult> {
  const { clientReturnSuccessUrl, clientReturnFailureUrl } = getVnPayClientReturnUrls()
  const payRes = await paymentService.createVNPay(orderId, {
    clientReturnSuccessUrl,
    clientReturnFailureUrl,
  })
  if (!payRes.success || !payRes.paymentUrl) {
    return { kind: 'error', message: payRes.message }
  }

  pendingVnPayUrl = payRes.paymentUrl
  router.push('/payment/vnpay-web' as never)
  return { kind: 'opened' }
}

/**
 * Mở VNPay cho NHIỀU đơn hàng (multi-shop checkout) — gộp tất cả vào 1 giao dịch.
 */
export async function startVnPayBatchInAppSession(orderIds: string[]): Promise<VnPayInAppResult> {
  if (orderIds.length === 1) {
    return startVnPayInAppSession(orderIds[0])
  }

  const { clientReturnSuccessUrl, clientReturnFailureUrl } = getVnPayClientReturnUrls()
  const payRes = await paymentService.createVNPayBatch(orderIds, {
    clientReturnSuccessUrl,
    clientReturnFailureUrl,
  })
  if (!payRes.success || !payRes.paymentUrl) {
    return { kind: 'error', message: payRes.message }
  }

  pendingVnPayUrl = payRes.paymentUrl
  router.push('/payment/vnpay-web' as never)
  return { kind: 'opened' }
}
