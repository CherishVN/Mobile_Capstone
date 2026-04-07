import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { orderService } from '@/services/order-service'
import { paymentService } from '@/services/payment-service'
import { cartService } from '@/services/cart-service'
import { Order, OrderStatus, getOrderStatusColor } from '@/types/order'
import ReviewModal from '@/components/ReviewModal'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import { markPendingPaymentOrder } from '@/lib/pending-payment'
import { startVnPayInAppSession } from '@/lib/vnpay-in-app'
import ProductReviewOrderModal from '@/components/ProductReviewOrderModal'
import ShopReviewOrderModal, {
  hasStoredShopReviewForOrder,
} from '@/components/ShopReviewOrderModal'

const REORDERABLE_STATUSES = new Set([5, 6, 7, 8])

export default function OrderDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const orderId = params.id as string
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [paying, setPaying] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null)
  const [shopReviewStored, setShopReviewStored] = useState(false)
  const [productReviewOpen, setProductReviewOpen] = useState(false)
  const [shopReviewOpen, setShopReviewOpen] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    hasStoredShopReviewForOrder(orderId).then(setShopReviewStored)
  }, [orderId])

  const loadOrder = async () => {
    try {
      const response = await orderService.getOrderById(orderId)
      if (response.success && response.order) {
        setOrder(response.order)
      } else {
        setOrder(null)
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin đơn hàng')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleCancelPending = () => {
    Alert.alert('Hủy đơn hàng', 'Chỉ hủy được đơn đang chờ thanh toán. Tiếp tục?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true)
          try {
            await orderService.cancelPendingOrder(orderId)
            Alert.alert('Thành công', 'Đã hủy đơn hàng')
            await loadOrder()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể hủy đơn hàng')
          } finally {
            setCancelling(false)
          }
        },
      },
    ])
  }

  const handleConfirmReceived = () => {
    Alert.alert('Xác nhận', 'Bạn đã nhận được hàng?', [
      { text: 'Chưa', style: 'cancel' },
      {
        text: 'Đã nhận',
        onPress: async () => {
          setConfirming(true)
          try {
            await orderService.confirmReceived(orderId)
            Alert.alert('Thành công', 'Cảm ơn bạn đã xác nhận')
            await loadOrder()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xác nhận')
          } finally {
            setConfirming(false)
          }
        },
      },
    ])
  }

  const openPaymentUrl = async (kind: 'vnpay' | 'momo') => {
    setPaying(true)
    try {
      if (kind === 'vnpay') {
        await markPendingPaymentOrder(orderId)
        const r = await startVnPayInAppSession(orderId)
        if (r.kind === 'error') {
          Alert.alert('Lỗi', r.message || 'Không tạo được link thanh toán')
        }
        await loadOrder()
      } else {
        const res = await paymentService.createMoMo(orderId)
        if (res.success && res.paymentUrl) {
          await markPendingPaymentOrder(orderId)
          const can = await Linking.canOpenURL(res.paymentUrl)
          if (can) await Linking.openURL(res.paymentUrl)
          else Alert.alert('Lỗi', 'Không mở được trình duyệt thanh toán')
        } else {
          Alert.alert('Lỗi', res.message || 'Không tạo được link thanh toán')
        }
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Thanh toán thất bại')
    } finally {
      setPaying(false)
    }
  }

  const handleReorder = async () => {
    if (!order) return
    setReordering(true)
    let successCount = 0
    let failedCount = 0

    for (const item of order.items) {
      try {
        await cartService.addItem({ productId: item.productId, quantity: item.quantity })
        successCount++
      } catch {
        failedCount++
      }
    }

    if (successCount > 0) {
      Alert.alert('Thành công', `Đã thêm ${successCount} sản phẩm vào giỏ hàng`, [
        { text: 'Xem giỏ hàng', onPress: () => router.push('/cart') },
        { text: 'OK' },
      ])
    }
    if (failedCount > 0) {
      Alert.alert('Lỗi', `${failedCount} sản phẩm mua lại thất bại`)
    }
    setReordering(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return <Loading />
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy đơn hàng</Text>
      </View>
    )
  }

  const statusColor = getOrderStatusColor(order.status)
  const canCancelPending = order.status === OrderStatus.PendingPayment
  const canPay = order.status === OrderStatus.PendingPayment
  const canConfirmReceive = order.status === OrderStatus.Shipping
  const canReorder = REORDERABLE_STATUSES.has(order.status)
  const canReview =
    order.status === OrderStatus.Completed &&
    order.items.some((i) => i.hasReviewedByUser !== true)
  const isCompleted = order.status === OrderStatus.Completed
  const canReviewProducts =
    isAuthenticated && isCompleted && order.items.some((i) => i.hasReviewedByUser !== true)
  const canReviewShop = isAuthenticated && isCompleted && !shopReviewStored
  const showReviewActions = canReviewProducts || canReviewShop

  const goShop = () => {
    if (order.shopSlug) {
      router.push(`/shop/${order.shopSlug}`)
    } else {
      Alert.alert('Thông báo', 'Không có liên kết cửa hàng')
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{order.statusName}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Đặt lúc: {formatDate(order.createdAt)}</Text>
        </View>

        {/* Shop section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Cửa hàng</Text>
          </View>
          <TouchableOpacity
            style={styles.shopCard}
            onPress={goShop}
            activeOpacity={0.7}
            disabled={!order.shopSlug}
          >
            <Text style={styles.shopName}>{order.shopName}</Text>
            <View style={styles.shopBtns}>
              <TouchableOpacity
                style={styles.shopSmallBtn}
                onPress={() => router.push('/messages' as any)}
              >
                <Ionicons name="chatbubble-outline" size={14} color={COLORS.primary} />
                <Text style={styles.shopSmallBtnText}>Chat</Text>
              </TouchableOpacity>
              {order.shopSlug ? (
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Products section with images */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Sản phẩm</Text>
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={styles.productItem}>
              <View style={styles.productThumb}>
                {item.productImage ? (
                  <Image source={{ uri: item.productImage }} style={styles.productImage} />
                ) : (
                  <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.productName}
                </Text>
                {item.variantName && <Text style={styles.productVariant}>{item.variantName}</Text>}
                {isCompleted && item.hasReviewedByUser !== true && (
                  <Text style={styles.reviewHint}>Chưa đánh giá sản phẩm</Text>
                )}
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{formatPrice(item.unitPrice)}</Text>
                  <Text style={styles.productQuantity}>x{item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          </View>
          <Text style={styles.addressText}>{order.shippingAddress || '—'}</Text>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính:</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí vận chuyển:</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.shippingFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer actions */}
  {/* Footer actions */}
  {(canPay ||
    canCancelPending ||
    canConfirmReceive ||
    canReview ||
    canReorder ||
    showReviewActions) && (
        <View style={styles.footer}>
          {canPay && (
            <>
              <Button
                title="Thanh toán VNPay"
                onPress={() => openPaymentUrl('vnpay')}
                loading={paying}
                fullWidth
                size="lg"
              />
              <Button
                title="Thanh toán MoMo"
                onPress={() => openPaymentUrl('momo')}
                loading={paying}
                variant="outline"
                fullWidth
                size="lg"
              />
            </>
          )}
          {canConfirmReceive && (
            <Button
              title="Đã nhận hàng"
              onPress={handleConfirmReceived}
              loading={confirming}
              fullWidth
              size="lg"
            />
          )}
          {canReview && (
            <Button
              title="⭐ Đánh Giá"
              onPress={() => setReviewingOrder(order)}
              fullWidth
              size="lg"
            />
          )}
          {canReorder && (
            <Button
              title={reordering ? 'Đang thêm...' : '🔄 Mua lại'}
              onPress={handleReorder}
              loading={reordering}
              variant="outline"
              fullWidth
              size="lg"
            />
          )}
          {canCancelPending && (
            <Button
              title="Hủy đơn (chờ thanh toán)"
              onPress={handleCancelPending}
              loading={cancelling}
              variant="outline"
              fullWidth
            />
          )}
          {canReviewProducts && (
            <Button
              title="Đánh giá sản phẩm"
              onPress={() => setProductReviewOpen(true)}
              variant="outline"
              fullWidth
              size="lg"
            />
          )}
          {canReviewShop && (
            <Button
              title="Đánh giá cửa hàng"
              onPress={() => setShopReviewOpen(true)}
              variant="outline"
              fullWidth
              size="lg"
            />
          )}
        </View>
      )}

      {/* Review modal */}
      {reviewingOrder && (
        <ReviewModal
          visible={!!reviewingOrder}
          order={reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSuccess={() => {
            setReviewingOrder(null)
            loadOrder()
          }}
        />
      )}

      {order && (
        <>
          <ProductReviewOrderModal
            visible={productReviewOpen}
            order={order}
            onClose={() => setProductReviewOpen(false)}
            onSuccess={() => loadOrder()}
          />
          <ShopReviewOrderModal
            visible={shopReviewOpen}
            orderId={order.id}
            shopId={order.shopId}
            shopName={order.shopName}
            onClose={() => setShopReviewOpen(false)}
            onSuccess={() => {
              setShopReviewStored(true)
              loadOrder()
            }}
          />
        </>
      )}
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
  statusCard: {
    backgroundColor: COLORS.card,
    padding: SIZES.lg,
    marginBottom: SIZES.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  orderCode: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.card,
    padding: SIZES.lg,
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
  shopCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    borderRadius: 8,
  },
  shopName: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    flex: 1,
  },
  shopBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  shopSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shopSmallBtnText: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  productItem: {
    flexDirection: 'row',
    gap: SIZES.md,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: FONTS.size.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  productVariant: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  reviewHint: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  productQuantity: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  addressText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
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
    gap: SIZES.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
  },
})
