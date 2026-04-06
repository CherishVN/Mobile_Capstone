import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { cartService } from '@/services/cart-service'
import { userService } from '@/services/user-service'
import { orderService } from '@/services/order-service'
import { paymentService } from '@/services/payment-service'
import { Cart } from '@/types/cart'
import { Address } from '@/types/user'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'

export default function CheckoutScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [cart, setCart] = useState<Cart | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    loadData()
  }, [isAuthenticated])

  const loadData = async () => {
    try {
      const [cartRes, addressesRes] = await Promise.all([
        cartService.getMyCart(),
        userService.getAddresses(),
      ])

      if (cartRes.success && cartRes.data) {
        setCart(cartRes.data)
      }

      if (addressesRes.success && addressesRes.data) {
        setAddresses(addressesRes.data)
        const defaultAddr = addressesRes.data.find((a) => a.isDefault)
        setSelectedAddress(defaultAddr || addressesRes.data[0] || null)
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin thanh toán')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!cart || !selectedAddress) {
      Alert.alert('Lỗi', 'Vui lòng chọn địa chỉ giao hàng')
      return
    }

    setSubmitting(true)
    try {
      const response = await orderService.checkout({
        cartId: cart.id,
        shippingAddressId: selectedAddress.id,
      })

      const payload = response.data
      const orderIds = payload?.orderIds || []
      const n = orderIds.length

      if (!response.success || !payload?.success || n === 0) {
        throw new Error(payload?.message || response.message || 'Đặt hàng thất bại')
      }

      const firstOrderId = orderIds[0]

      const msg =
        n > 1
          ? `Đã tạo ${n} đơn (mỗi cửa hàng một đơn). Có thể thanh toán đơn đầu tiên hoặc xem tất cả trong mục Đơn hàng.`
          : 'Đơn hàng đã được tạo. Chọn thanh toán hoặc xem trong mục Đơn hàng.'

      Alert.alert('Đặt hàng thành công', msg, [
        { text: 'Đơn hàng', style: 'cancel', onPress: () => router.replace('/(tabs)/orders') },
        {
          text: 'VNPay',
          onPress: async () => {
            try {
              const pay = await paymentService.createVNPay(firstOrderId)
              if (pay.success && pay.paymentUrl) await Linking.openURL(pay.paymentUrl)
            } catch {
              /* empty */
            }
            router.replace('/(tabs)/orders')
          },
        },
        {
          text: 'MoMo',
          onPress: async () => {
            try {
              const pay = await paymentService.createMoMo(firstOrderId)
              if (pay.success && pay.paymentUrl) await Linking.openURL(pay.paymentUrl)
            } catch {
              /* empty */
            }
            router.replace('/(tabs)/orders')
          },
        },
      ])
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đặt hàng')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  const formatAddress = (address: Address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.ward,
      address.district,
      address.city,
      address.province,
    ].filter(Boolean)
    return parts.join(', ')
  }

  if (loading) {
    return <Loading />
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>Giỏ hàng trống</Text>
        <Button title="Quay lại" onPress={() => router.back()} style={styles.errorButton} />
      </View>
    )
  }

  const shippingFee = 30000
  const total = cart.subtotal + shippingFee

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          </View>

          {selectedAddress ? (
            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => router.push('/profile/addresses')}
              activeOpacity={0.7}
            >
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>{selectedAddress.fullName}</Text>
                <Text style={styles.addressPhone}>{selectedAddress.phone}</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {formatAddress(selectedAddress)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => router.push('/profile/addresses')}
            >
              <Text style={styles.addAddressText}>+ Thêm địa chỉ giao hàng</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Sản phẩm ({cart.totalItems})</Text>
          </View>

          {cart.items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.orderItemName} numberOfLines={1}>
                {item.productName}
                {item.variantName && ` - ${item.variantName}`}
              </Text>
              <View style={styles.orderItemRow}>
                <Text style={styles.orderItemPrice}>{formatPrice(item.unitPrice)}</Text>
                <Text style={styles.orderItemQuantity}>x{item.quantity}</Text>
                <Text style={styles.orderItemTotal}>{formatPrice(item.lineTotal)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính:</Text>
            <Text style={styles.summaryValue}>{formatPrice(cart.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí vận chuyển:</Text>
            <Text style={styles.summaryValue}>{formatPrice(shippingFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Tổng thanh toán:</Text>
          <Text style={styles.footerTotal}>{formatPrice(total)}</Text>
        </View>
        <Button
          title="Đặt hàng"
          onPress={handleCheckout}
          loading={submitting}
          disabled={!selectedAddress}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SIZES.xs,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SIZES.lg,
    backgroundColor: COLORS.card,
    marginBottom: SIZES.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  addressCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    borderRadius: 8,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  addressPhone: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xs,
  },
  addressText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  addAddressButton: {
    padding: SIZES.md,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addAddressText: {
    fontSize: FONTS.size.md,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  orderItem: {
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderItemName: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemPrice: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  orderItemQuantity: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  orderItemTotal: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  summaryLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.md,
  },
  totalLabel: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  footer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SIZES.md,
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
  },
  footerTotal: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: FONTS.size.lg,
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
  },
  errorButton: {
    marginTop: SIZES.lg,
  },
})
