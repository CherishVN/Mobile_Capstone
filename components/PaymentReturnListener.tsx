import { useAuthStore } from '@/store/auth-store'
import { usePaymentReturnRecovery } from '@/hooks/usePaymentReturnRecovery'
import { useRouter } from 'expo-router'

/** Gắn trong root layout — lắng nghe quay lại app sau thanh toán cổng (VNPay/MoMo). */
export default function PaymentReturnListener() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  usePaymentReturnRecovery(isAuthenticated, router)
  return null
}
