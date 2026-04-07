import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'payment:pendingOrderId'

/** Gọi trước khi mở VNPay/MoMo — để khi quay lại app có thể kiểm tra trạng thái đơn (BE redirect web localhost không mở được trên emulator). */
export async function markPendingPaymentOrder(orderId: string): Promise<void> {
  if (!orderId) return
  await AsyncStorage.setItem(KEY, orderId)
}

export async function clearPendingPaymentOrder(): Promise<void> {
  await AsyncStorage.removeItem(KEY)
}

export async function getPendingPaymentOrderId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY)
  } catch {
    return null
  }
}
