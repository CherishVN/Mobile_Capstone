import React, { useCallback, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router'
import { StackActions } from '@react-navigation/native'
import type { Href } from 'expo-router'
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
  const navigation = useNavigation()
  const params = useLocalSearchParams<{ orderId?: string | string[]; amount?: string | string[] }>()
  const orderId = pickParam(params.orderId)
  const amountRaw = pickParam(params.amount)

  const amountLabel =
    amountRaw && !Number.isNaN(Number(amountRaw))
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amountRaw))
      : null

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    if (orderId) void clearPendingPaymentOrder()

    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [orderId])

  // Stack: (tabs) -> orders/[id] -> payment/success. replace() only swapped top; Back still hit stale order (pay UI). Pop 2 then navigate.
  const exitSuccessThen = useCallback(
    (action: () => void) => {
      navigation.dispatch(StackActions.pop(2))
      queueMicrotask(action)
    },
    [navigation]
  )

  const goToOrderDetail = useCallback(() => {
    if (!orderId) return
    exitSuccessThen(() => {
      router.push(`/orders/${orderId}` as Href)
    })
  }, [orderId, exitSuccessThen, router])

  const goToHome = useCallback(() => {
    exitSuccessThen(() => {
      router.replace('/(tabs)/home' as Href)
    })
  }, [exitSuccessThen, router])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Animated Success Icon */}
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconInner}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Thanh toán thành công!</Text>
          <Text style={styles.sub}>
            Đơn hàng đã được ghi nhận và đang chờ xác nhận từ người bán.
          </Text>

          {/* Info Card */}
          <View style={styles.infoCard}>
            {amountLabel && (
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="wallet-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.infoTexts}>
                  <Text style={styles.infoLabel}>Số tiền thanh toán</Text>
                  <Text style={styles.infoValue}>{amountLabel}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>Trạng thái</Text>
                <Text style={[styles.infoValue, { color: COLORS.success }]}>Đã thanh toán</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoTexts}>
                <Text style={styles.infoLabel}>Bước tiếp theo</Text>
                <Text style={styles.infoHint}>Shop sẽ xác nhận và chuẩn bị đơn hàng cho bạn</Text>
              </View>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.btnGroup}>
            {orderId ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={goToOrderDetail} activeOpacity={0.85}>
                <Ionicons name="receipt-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Xem đơn hàng</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/orders')} activeOpacity={0.85}>
                <Ionicons name="list-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Về danh sách đơn hàng</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={orderId ? goToHome : () => router.replace('/(tabs)/home')}
              activeOpacity={0.85}
            >
              <Ionicons name="home-outline" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Tiếp tục mua sắm</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF9F8' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.xl,
  },

  /* Animated Icon */
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  /* Content */
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SIZES.xs,
    textAlign: 'center',
  },
  sub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.lg,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SIZES.md,
  },

  /* Info Card */
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.xl,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(236, 127, 19, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTexts: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  infoHint: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },

  /* Buttons */
  btnGroup: {
    width: '100%',
    gap: SIZES.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONTS.size.md,
  },
  secondaryBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: FONTS.size.md,
  },
})
