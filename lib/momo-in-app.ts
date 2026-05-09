import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { paymentService } from '@/services/payment-service'

let pendingMoMoUrl: string | null = null

export function consumePendingMoMoUrl(): string | null {
  const u = pendingMoMoUrl
  pendingMoMoUrl = null
  return u
}

function isAppDeepLink(url: string): boolean {
  const u = url.trim().toLowerCase()
  return u.startsWith('ecommerce://') || u.startsWith('exp://') || u.startsWith('exps://')
}

/**
 * WebView gặp redirect từ BE sang deep link → chặn load và điều hướng trong Expo Router.
 */
export function tryCompleteMoMoWebViewReturn(url: string): boolean {
  if (!url) return false

  const lower = url.toLowerCase()
  const isWebReturn = lower.includes('payment/success') || lower.includes('payment/failed')

  if (!isAppDeepLink(url) && !isWebReturn) return false

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
 * Kiểm tra URL trả về của MoMo (redirect về BE hoặc localhost).
 */
export function isMoMoReturnUrl(url: string): boolean {
  // MoMo có thể redirect về BE callback hoặc deep link
  if (isAppDeepLink(url)) return true
  // Bắt localhost redirect
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return true
  return false
}

export type MoMoInAppResult =
  | { kind: 'opened' }
  | { kind: 'error'; message?: string }

/**
 * Mở MoMo trong WebView full-screen (cùng process Expo Go), không dùng trình duyệt ngoài.
 */
export async function startMoMoInAppSession(orderId: string): Promise<MoMoInAppResult> {
  const payRes = await paymentService.createMoMo(orderId)
  if (!payRes.success || !payRes.paymentUrl) {
    return { kind: 'error', message: payRes.message }
  }

  pendingMoMoUrl = payRes.paymentUrl
  router.push('/payment/momo-web' as never)
  return { kind: 'opened' }
}

/**
 * Mở MoMo cho NHIỀU đơn hàng (multi-shop checkout) — gộp tất cả vào 1 giao dịch.
 */
export async function startMoMoBatchInAppSession(orderIds: string[]): Promise<MoMoInAppResult> {
  if (orderIds.length === 1) {
    return startMoMoInAppSession(orderIds[0])
  }

  const payRes = await paymentService.createMoMoBatch(orderIds)
  if (!payRes.success || !payRes.paymentUrl) {
    return { kind: 'error', message: payRes.message }
  }

  pendingMoMoUrl = payRes.paymentUrl
  router.push('/payment/momo-web' as never)
  return { kind: 'opened' }
}
