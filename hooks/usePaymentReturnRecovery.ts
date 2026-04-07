import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus, Alert } from 'react-native'
import type { Href } from 'expo-router'
import { orderService } from '@/services/order-service'
import { OrderStatus } from '@/types/order'
import {
  clearPendingPaymentOrder,
  getPendingPaymentOrderId,
} from '@/lib/pending-payment'

/**
 * Khi user thanh toán VNPay/MoMo, BE redirect browser tới FrontendUrl (localhost:3000) —
 * trên Android emulator URL đó lỗi. Thanh toán vẫn thành công trên server.
 * Hook này: khi app lên foreground, nếu có đơn đang chờ thanh toán thì gọi API kiểm tra
 * và báo thành công / hủy, mở chi tiết đơn.
 */
type AppRouter = { push: (href: Href) => void }

export function usePaymentReturnRecovery(enabled: boolean, router: AppRouter) {
  const appState = useRef<AppStateStatus>(AppState.currentState)
  const handling = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const resolvePending = async () => {
      if (handling.current) return
      const orderId = await getPendingPaymentOrderId()
      if (!orderId) return

      handling.current = true
      try {
        const res = await orderService.getOrderById(orderId)
        if (!res.success || !res.order) {
          handling.current = false
          return
        }

        const s = res.order.status

        if (s === OrderStatus.PendingPayment) {
          handling.current = false
          return
        }

        await clearPendingPaymentOrder()

        if (s === OrderStatus.Cancelled) {
          Alert.alert(
            'Thanh toán',
            'Đơn đã hủy hoặc thanh toán không thành công. Kiểm tra lại mục Đơn hàng.'
          )
          return
        }

        Alert.alert(
          'Thanh toán thành công',
          `Đơn #${res.order.orderCode} đã được thanh toán.`,
          [
            {
              text: 'Xem đơn',
              onPress: () => router.push(`/orders/${orderId}` as Href),
            },
            { text: 'OK', style: 'cancel' },
          ]
        )
      } catch {
        /* ignore */
      } finally {
        handling.current = false
      }
    }

    const onActive = () => {
      setTimeout(() => void resolvePending(), 500)
    }

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        onActive()
      }
      appState.current = next
    })

    onActive()

    return () => sub.remove()
  }, [enabled, router])
}
