import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useAuthStore } from '@/store/auth-store'
import PaymentReturnListener from '@/components/PaymentReturnListener'

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [])

  return (
    <>
      <PaymentReturnListener />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="products/[slug]" />
        <Stack.Screen name="products/index" />
        <Stack.Screen name="cart/index" />
        <Stack.Screen name="checkout/index" />
        <Stack.Screen name="search/index" />
        <Stack.Screen name="orders/[id]" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="profile/addresses" />
        <Stack.Screen name="profile/change-password" />
        <Stack.Screen name="profile/favorites" />
        <Stack.Screen name="profile/notifications" />
        <Stack.Screen name="assistant/index" />
        <Stack.Screen name="payment/success" />
        <Stack.Screen name="payment/failed" />
        <Stack.Screen name="payment/vnpay-web" />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="shop/[slug]" />
      </Stack>
    </>
  )
}
