import React, { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { clearPendingPaymentOrder } from '@/lib/pending-payment'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

function pickParam(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' ? v : v?.[0]
}

/** Dùng khi deep link / redirect về app (scheme ecommerce://). */
export default function PaymentSuccessScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ orderId?: string | string[]; amount?: string | string[] }>()
  const orderId = pickParam(params.orderId)
  const amountRaw = pickParam(params.amount)

  const amountLabel =
    amountRaw && !Number.isNaN(Number(amountRaw))
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amountRaw))
      : null

  useEffect(() => {
    if (orderId) void clearPendingPaymentOrder()
  }, [orderId])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
        </View>
        <Text style={styles.title}>Thanh toán thành công</Text>
        <Text style={styles.sub}>
          Đơn hàng đã được ghi nhận. Bạn có thể xem chi tiết và trạng thái giao hàng trong mục Đơn hàng.
        </Text>
        {amountLabel ? <Text style={styles.amount}>Số tiền: {amountLabel}</Text> : null}
        {orderId ? <Text style={styles.hint}>Thông tin đơn đã được đồng bộ — mở chi tiết đơn để xem đầy đủ.</Text> : null}
        {orderId ? (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace(`/orders/${orderId}`)}
          >
            <Text style={styles.btnText}>Xem đơn hàng</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/orders')}>
            <Text style={styles.btnText}>Về danh sách đơn hàng</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondary} onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.secondaryText}>Tiếp tục mua sắm</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SIZES.xl,
    paddingBottom: SIZES.xl,
  },
  iconWrap: { alignItems: 'center', marginBottom: SIZES.lg },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.sm,
    textAlign: 'center',
  },
  sub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  amount: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SIZES.xs,
  },
  hint: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.lg,
  },
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  btnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONTS.size.md },
  secondary: {
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.size.sm },
})
