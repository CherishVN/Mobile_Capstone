import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { cartService } from '@/services/cart-service'
import { userService } from '@/services/user-service'
import { orderService } from '@/services/order-service'
import { paymentService } from '@/services/payment-service'
import { startVnPayInAppSession } from '@/lib/vnpay-in-app'
import { productService } from '@/services/product-service'
import { Cart, CartItem } from '@/types/cart'
import { Address } from '@/types/user'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { markPendingPaymentOrder } from '@/lib/pending-payment'

const CHECKOUT_SELECTED_IDS_KEY = 'checkout:selected-item-ids'
const SHIPPING_FEE_PER_SHOP = 30000

type PaymentMethod = 'vnpay' | 'momo'

type CartItemWithShop = CartItem & {
  shopId?: string
  shopName?: string
}

interface ShopGroup {
  key: string
  shopName: string
  items: CartItemWithShop[]
  subtotal: number
  shippingFee: number
  total: number
  itemCount: number
}

export default function CheckoutScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [cart, setCart] = useState<Cart | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vnpay')
  const [checkoutItems, setCheckoutItems] = useState<CartItemWithShop[]>([])

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    loadData()
  }, [isAuthenticated])

  const enrichItemsWithShop = async (items: CartItem[]): Promise<CartItemWithShop[]> => {
    const initial = items.map((item) => item as CartItemWithShop)
    const missingShop = initial.filter((item) => !item.shopId || !item.shopName)

    if (missingShop.length === 0) return initial

    try {
      const uniqueProductIds = Array.from(new Set(missingShop.map((item) => item.productId)))
      const resolvedMap = new Map<string, { shopId?: string; shopName?: string }>()

      const results = await Promise.allSettled(
        uniqueProductIds.map(async (productId) => {
          const res = await productService.getProductById(productId)
          return { productId, product: res.product }
        })
      )

      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value.product) continue
        resolvedMap.set(result.value.productId, {
          shopId: result.value.product.shopId,
          shopName: result.value.product.shopName,
        })
      }

      return initial.map((item) => {
        const resolved = resolvedMap.get(item.productId)
        return {
          ...item,
          shopId: item.shopId ?? resolved?.shopId,
          shopName: item.shopName ?? resolved?.shopName ?? 'Shop không xác định',
        }
      })
    } catch {
      return initial
    }
  }

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

      // Get selected item IDs from cart page
      const allItems: CartItem[] = cartRes?.data?.items ?? []
      let selectedItemIds: string[] = []

      try {
        const raw = await AsyncStorage.getItem(CHECKOUT_SELECTED_IDS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            selectedItemIds = parsed.filter((id): id is string => typeof id === 'string')
          }
        }
      } catch {
        selectedItemIds = []
      }

      let itemsToCheckout = allItems
      if (selectedItemIds.length > 0) {
        const selectedSet = new Set(selectedItemIds)
        const filtered = allItems.filter((item) => selectedSet.has(item.id))
        if (filtered.length > 0) itemsToCheckout = filtered
      }

      const enriched = await enrichItemsWithShop(itemsToCheckout)
      setCheckoutItems(enriched)
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin thanh toán')
    } finally {
      setLoading(false)
    }
  }

  /* ── Shop grouping (like web) ── */
  const groupedByShop = useMemo<ShopGroup[]>(() => {
    const map = new Map<string, ShopGroup>()

    checkoutItems.forEach((item, index) => {
      const shopName = item.shopName?.trim() || 'Shop không xác định'
      const key = item.shopId || shopName.toLowerCase() || `shop-${index}`

      const existing = map.get(key)
      if (existing) {
        existing.items.push(item)
        existing.subtotal += item.lineTotal
        existing.itemCount += item.quantity
        return
      }

      map.set(key, {
        key,
        shopName,
        items: [item],
        subtotal: item.lineTotal,
        shippingFee: SHIPPING_FEE_PER_SHOP,
        total: 0,
        itemCount: item.quantity,
      })
    })

    return Array.from(map.values()).map((group) => ({
      ...group,
      total: group.subtotal + group.shippingFee,
    }))
  }, [checkoutItems])

  const subtotalAmount = groupedByShop.reduce((s, g) => s + g.subtotal, 0)
  const shippingAmount = groupedByShop.reduce((s, g) => s + g.shippingFee, 0)
  const grandTotal = subtotalAmount + shippingAmount
  const totalProductCount = checkoutItems.reduce((s, i) => s + i.quantity, 0)

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

      // Clear selected IDs
      try {
        await AsyncStorage.removeItem(CHECKOUT_SELECTED_IDS_KEY)
      } catch {}

      const firstOrderId = orderIds[0]
      const label = paymentMethod === 'momo' ? 'MoMo' : 'VNPay'

      if (n > 1) {
        Alert.alert('Thông tin', `Đã tạo ${n} đơn (mỗi cửa hàng một đơn).`)
      }

      // Auto-pay with selected method
      let skipGoToOrders = false
      try {
        if (paymentMethod === 'vnpay') {
          await markPendingPaymentOrder(firstOrderId)
          const vn = await startVnPayInAppSession(firstOrderId)
          if (vn.kind === 'error') {
            Alert.alert('Lỗi', vn.message || `Không thể tạo giao dịch ${label}`)
          } else if (vn.kind === 'opened') {
            skipGoToOrders = true
          }
        } else {
          const payRes = await paymentService.createMoMo(firstOrderId)
          if (payRes.success && payRes.paymentUrl) {
            await markPendingPaymentOrder(firstOrderId)
            await Linking.openURL(payRes.paymentUrl)
          } else {
            Alert.alert('Lỗi', payRes.message || `Không thể tạo giao dịch ${label}`)
          }
        }
      } catch {
        // Payment failed but order was created
      }

      if (!skipGoToOrders) {
        router.replace('/(tabs)/orders')
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đặt hàng')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)

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

  if (!cart || checkoutItems.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>Không có sản phẩm để thanh toán</Text>
        <Button title="Quay lại" onPress={() => router.back()} style={styles.errorButton} />
      </View>
    )
  }

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
        {/* Address section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Địa chỉ nhận hàng</Text>
          </View>

          {selectedAddress ? (
            <TouchableOpacity
              style={styles.addressCard}
              onPress={() => router.push('/profile/addresses')}
              activeOpacity={0.7}
            >
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>
                  {selectedAddress.fullName || selectedAddress.label || 'Người nhận'}
                </Text>
                {selectedAddress.phone && (
                  <Text style={styles.addressPhone}>{selectedAddress.phone}</Text>
                )}
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

        {/* Shop groups */}
        {groupedByShop.map((group) => (
          <View key={group.key} style={styles.section}>
            <View style={styles.shopHeader}>
              <View style={styles.shopNameRow}>
                <Ionicons name="storefront" size={16} color={COLORS.primary} />
                <Text style={styles.shopNameText}>{group.shopName}</Text>
                <Text style={styles.shopItemCount}>{group.itemCount} sản phẩm</Text>
              </View>
              <View style={styles.shopBadge}>
                <Text style={styles.shopBadgeText}>Tách đơn theo shop</Text>
              </View>
            </View>

            {group.items.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderItemThumb}>
                  {item.productImage ? (
                    <Image source={{ uri: item.productImage }} style={styles.orderItemImage} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={styles.orderItemInfo}>
                  <Text style={styles.orderItemName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  {item.variantName && (
                    <Text style={styles.orderItemVariant}>Phân loại: {item.variantName}</Text>
                  )}
                </View>
                <View style={styles.orderItemRight}>
                  <Text style={styles.orderItemPrice}>{formatPrice(item.unitPrice)}</Text>
                  <Text style={styles.orderItemQty}>x{item.quantity}</Text>
                  <Text style={styles.orderItemTotal}>{formatPrice(item.lineTotal)}</Text>
                </View>
              </View>
            ))}

            {/* Shop subtotal */}
            <View style={styles.shopFooter}>
              <View style={styles.shippingRow}>
                <Ionicons name="car-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.shippingLabel}>Phí vận chuyển</Text>
                <Text style={styles.shippingValue}>
                  Nhanh - {formatPrice(group.shippingFee)}
                </Text>
              </View>
              <View style={styles.shopTotalRow}>
                <Text style={styles.shopTotalLabel}>Tổng shop:</Text>
                <Text style={styles.shopTotalValue}>{formatPrice(group.total)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Payment method selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'vnpay' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod('vnpay')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentLeft}>
              <View style={styles.paymentIcon}>
                <Text style={styles.paymentIconText}>VN</Text>
              </View>
              <View>
                <Text style={styles.paymentName}>VNPay</Text>
                <Text style={styles.paymentDesc}>Thanh toán qua cổng VNPay bảo mật</Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'vnpay' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'vnpay' ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'momo' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMethod('momo')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#d82d8b20' }]}>
                <Text style={[styles.paymentIconText, { color: '#d82d8b' }]}>M</Text>
              </View>
              <View>
                <Text style={styles.paymentName}>MoMo</Text>
                <Text style={styles.paymentDesc}>Ví điện tử MoMo</Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'momo' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'momo' ? COLORS.primary : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.summaryTitle}>Tóm tắt đơn hàng</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng tiền hàng</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotalAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
            <Text style={styles.summaryValue}>{formatPrice(shippingAmount)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.grandTotalLabel}>Tổng thanh toán</Text>
            <Text style={styles.grandTotalValue}>{formatPrice(grandTotal)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.termsRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.termsText}>
            Nhấn "Đặt hàng" đồng nghĩa với việc bạn đồng ý tuân theo điều khoản của hệ thống.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Tổng thanh toán:</Text>
          <Text style={styles.footerTotal}>{formatPrice(grandTotal)}</Text>
        </View>
        <Button
          title={submitting ? 'Đang xử lý...' : `Đặt hàng (${totalProductCount} sản phẩm)`}
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
  /* Address */
  addressCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    borderRadius: 10,
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
    borderRadius: 10,
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
  /* Shop group */
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
    paddingBottom: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    flex: 1,
  },
  shopNameText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  shopItemCount: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  shopBadge: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  shopBadgeText: {
    fontSize: FONTS.size.xs - 1,
    color: COLORS.primary,
    fontWeight: '500',
  },
  /* Order items */
  orderItem: {
    flexDirection: 'row',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  orderItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orderItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  orderItemVariant: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  orderItemRight: {
    alignItems: 'flex-end',
  },
  orderItemPrice: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  orderItemQty: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  orderItemTotal: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  shopFooter: {
    marginTop: SIZES.md,
    gap: SIZES.sm,
  },
  shippingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  shippingLabel: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  shippingValue: {
    fontSize: FONTS.size.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  shopTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  shopTotalLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  shopTotalValue: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  /* Payment method */
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  paymentOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentIconText: {
    fontSize: FONTS.size.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  paymentName: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  paymentDesc: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  /* Summary */
  summaryTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
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
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.md,
  },
  grandTotalLabel: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  grandTotalValue: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  /* Terms */
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.xs,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  termsText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  /* Footer */
  footer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.card,
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
  /* Error */
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
