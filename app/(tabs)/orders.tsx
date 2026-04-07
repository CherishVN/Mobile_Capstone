import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { orderService } from '@/services/order-service'
import { cartService } from '@/services/cart-service'
import { paymentService } from '@/services/payment-service'
import { Order, OrderItem, OrderStatus, getOrderStatusColor, getOrderStatusLabelVi } from '@/types/order'
import { useAuthStore } from '@/store/auth-store'
import ReviewModal from '@/components/ReviewModal'
import Loading from '@/components/Loading'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { markPendingPaymentOrder } from '@/lib/pending-payment'
import { startVnPayInAppSession } from '@/lib/vnpay-in-app'

/* ── Status tabs (khớp web 9 tabs) ── */
const STATUS_TABS: { label: string; value: number | undefined }[] = [
  { label: 'Tất cả', value: undefined },
  { label: 'Chờ thanh toán', value: 0 },
  { label: 'Chờ xác nhận', value: 1 },
  { label: 'Đã xác nhận', value: 2 },
  { label: 'Đang chuẩn bị', value: 3 },
  { label: 'Đang giao', value: 4 },
  { label: 'Đã giao', value: 5 },
  { label: 'Hoàn thành', value: 6 },
  { label: 'Đã hủy', value: 7 },
  { label: 'Hoàn tiền', value: 8 },
]

const REORDERABLE_STATUSES = new Set([5, 6, 7, 8])

export default function OrdersScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [searchText, setSearchText] = useState('')

  // Action states
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null)

  const filteredOrders = useMemo(() => {
    let result = allOrders

    // Filter by status tab
    const tabValue = STATUS_TABS[activeTab]?.value
    if (tabValue !== undefined) {
      result = result.filter((o) => o.status === tabValue)
    }

    // Filter by search
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter(
        (o) =>
          o.shopName.toLowerCase().includes(q) ||
          o.items.some((i) => i.productName.toLowerCase().includes(q))
      )
    }

    return result
  }, [allOrders, activeTab, searchText])

  const loadOrders = async () => {
    if (!isAuthenticated) {
      setAllOrders([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const response = await orderService.getMyOrders({ pageSize: 100 })
      if (response.success) {
        setAllOrders(response.orders)
      }
    } catch (error: any) {
      console.error('Failed to load orders:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadOrders()
  }, [isAuthenticated])

  /** Làm mới khi quay lại tab (sau thanh toán / chi tiết đơn) — không cần reload cả app. */
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return
      void (async () => {
        try {
          const response = await orderService.getMyOrders({ pageSize: 100 })
          if (response.success) setAllOrders(response.orders)
        } catch {
          /* giữ danh sách cũ */
        }
      })()
    }, [isAuthenticated])
  )

  const onRefresh = () => {
    setRefreshing(true)
    loadOrders()
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  /* ── Actions ── */
  const handleConfirmReceived = async (order: Order) => {
    Alert.alert('Xác nhận', 'Bạn đã nhận được hàng?', [
      { text: 'Chưa', style: 'cancel' },
      {
        text: 'Đã nhận',
        onPress: async () => {
          setConfirmingId(order.id)
          try {
            await orderService.confirmReceived(order.id)
            Alert.alert('Thành công', 'Cảm ơn bạn đã xác nhận')
            await loadOrders()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xác nhận')
          } finally {
            setConfirmingId(null)
          }
        },
      },
    ])
  }

  const handleReorder = async (order: Order) => {
    setReorderingId(order.id)
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
    setReorderingId(null)
  }

  const handlePayNow = async (order: Order, method: 'vnpay' | 'momo') => {
    setPayingId(order.id)
    try {
      if (method === 'vnpay') {
        await markPendingPaymentOrder(order.id)
        const r = await startVnPayInAppSession(order.id)
        if (r.kind === 'error') {
          Alert.alert('Lỗi', r.message || 'Không thể tạo giao dịch')
        }
        await loadOrders()
      } else {
        const res = await paymentService.createMoMo(order.id)
        if (res.success && res.paymentUrl) {
          await markPendingPaymentOrder(order.id)
          const can = await Linking.canOpenURL(res.paymentUrl)
          if (can) await Linking.openURL(res.paymentUrl)
          else Alert.alert('Lỗi', 'Không mở được trình duyệt thanh toán')
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể tạo giao dịch')
        }
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Thanh toán thất bại')
    } finally {
      setPayingId(null)
    }
  }

  const handleGoShop = (order: Order) => {
    if (order.shopSlug) {
      router.push(`/shop/${order.shopSlug}`)
    } else {
      Alert.alert('Thông báo', 'Không có liên kết cửa hàng')
    }
  }

  const handleChatShop = (order: Order) => {
    router.push('/messages' as any)
  }

  /* ── Render ── */
  const renderOrderItem = ({ item: order }: { item: Order }) => {
    const statusColor = getOrderStatusColor(order.status)
    const canConfirm = order.status === OrderStatus.Shipping
    const canPayNow = order.status === OrderStatus.PendingPayment
    const canReorder = REORDERABLE_STATUSES.has(order.status)
    const canReview =
      order.status === OrderStatus.Completed &&
      order.items.some((i) => i.hasReviewedByUser !== true)
    const isConfirming = confirmingId === order.id
    const isReordering = reorderingId === order.id
    const isPaying = payingId === order.id

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/orders/${order.id}`)}
        activeOpacity={0.7}
      >
        {/* Header: shop + status */}
        <View style={styles.orderHeader}>
          <View style={styles.shopRow}>
            <Ionicons name="storefront" size={16} color={COLORS.primary} />
            <Text style={styles.orderShop}>{order.shopName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{order.statusName}</Text>
          </View>
        </View>

        {/* Products with thumbnails */}
        <View style={styles.orderItems}>
          {order.items.slice(0, 3).map((product) => (
            <View key={product.id} style={styles.productRow}>
              <View style={styles.productThumb}>
                {product.productImage ? (
                  <Image source={{ uri: product.productImage }} style={styles.productThumbImg} />
                ) : (
                  <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
                )}
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.productName}
                </Text>
                {product.variantName && (
                  <Text style={styles.productVariant}>Phân loại: {product.variantName}</Text>
                )}
                <View style={styles.productMeta}>
                  <Text style={styles.productPrice}>{formatPrice(product.unitPrice)}</Text>
                  <Text style={styles.productQty}>x{product.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
          {order.items.length > 3 && (
            <Text style={styles.moreItems}>và {order.items.length - 3} sản phẩm khác</Text>
          )}
        </View>

        {/* Footer: date + total */}
        <View style={styles.orderFooter}>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
          <View style={styles.orderTotal}>
            <Text style={styles.totalLabel}>Thành tiền: </Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Shop actions */}
          <View style={styles.shopActions}>
            <TouchableOpacity
              style={styles.smallActionBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                handleChatShop(order)
              }}
            >
              <Ionicons name="chatbubble-outline" size={14} color={COLORS.primary} />
              <Text style={styles.smallActionText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallActionBtn}
              onPress={(e) => {
                e.stopPropagation?.()
                handleGoShop(order)
              }}
            >
              <Ionicons name="storefront-outline" size={14} color={COLORS.textSecondary} />
              <Text style={[styles.smallActionText, { color: COLORS.textSecondary }]}>Shop</Text>
            </TouchableOpacity>
          </View>

          {/* Primary actions */}
          <View style={styles.primaryActions}>
            {canPayNow && (
              <View style={styles.payRow}>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    handlePayNow(order, 'vnpay')
                  }}
                  disabled={isPaying}
                >
                  <Text style={styles.payBtnText}>{isPaying ? '...' : 'VNPay'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    handlePayNow(order, 'momo')
                  }}
                  disabled={isPaying}
                >
                  <Text style={styles.payBtnText}>{isPaying ? '...' : 'MoMo'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {canConfirm && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={(e) => {
                  e.stopPropagation?.()
                  handleConfirmReceived(order)
                }}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>Đã nhận hàng</Text>
                )}
              </TouchableOpacity>
            )}

            {canReview && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={(e) => {
                  e.stopPropagation?.()
                  setReviewingOrder(order)
                }}
              >
                <Ionicons name="star" size={14} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>Đánh Giá</Text>
              </TouchableOpacity>
            )}

            {canReorder && (
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={(e) => {
                  e.stopPropagation?.()
                  handleReorder(order)
                }}
                disabled={isReordering}
              >
                <Ionicons name="refresh" size={14} color={COLORS.text} />
                <Text style={styles.outlineBtnText}>
                  {isReordering ? 'Đang thêm...' : 'Mua lại'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Đơn hàng</Text>
        </View>
        <View style={styles.guestEmpty}>
          <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.guestTitle}>Đăng nhập để xem đơn hàng</Text>
          <Text style={styles.guestSub}>Theo dõi trạng thái và thanh toán sau khi đăng nhập.</Text>
          <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.guestBtn} />
        </View>
      </View>
    )
  }

  if (loading && !refreshing) {
    return <Loading />
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đơn hàng</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên Shop hoặc Sản phẩm"
          placeholderTextColor={COLORS.placeholder}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status tabs — không dùng gap (Android cắt chip); padding ngang khớp ô tìm kiếm */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
        nestedScrollEnabled
      >
        {STATUS_TABS.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.tab,
              activeTab === index && styles.tabActive,
              index < STATUS_TABS.length - 1 && styles.tabSpacing,
            ]}
            onPress={() => {
              setActiveTab(index)
              setSearchText('')
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders list */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có đơn hàng nào</Text>
            <Text style={styles.emptySubtext}>Bắt đầu mua sắm ngay</Text>
          </View>
        }
      />

      {/* Review modal */}
      {reviewingOrder && (
        <ReviewModal
          visible={!!reviewingOrder}
          order={reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSuccess={() => {
            setReviewingOrder(null)
            loadOrders()
          }}
        />
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
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  /* Search */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginHorizontal: SIZES.lg,
    marginVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    padding: 0,
  },
  /* Tabs */
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SIZES.lg,
    paddingRight: SIZES.lg,
    paddingVertical: SIZES.sm,
    minHeight: 48,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    overflow: 'visible',
    flexShrink: 0,
  },
  tabSpacing: {
    marginRight: SIZES.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '600',
  },
  /* List */
  listContent: {
    padding: SIZES.md,
  },
  /* Order Card */
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    flex: 1,
  },
  orderShop: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 6,
  },
  statusText: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
  /* Product items with thumbnails */
  orderItems: {
    marginBottom: SIZES.md,
    gap: SIZES.sm,
  },
  productRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    alignItems: 'center',
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productThumbImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: FONTS.size.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  productVariant: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  productPrice: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  productQty: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  moreItems: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    paddingLeft: 64,
  },
  /* Footer */
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  orderDate: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  orderTotal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: FONTS.size.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.md,
    paddingTop: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shopActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs + 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  smallActionText: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.onPrimary,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  outlineBtnText: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  payRow: {
    flexDirection: 'row',
    gap: SIZES.xs,
  },
  payBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  payBtnText: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.onPrimary,
  },
  /* Empty */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: SIZES.md,
  },
  emptySubtext: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  /* Guest */
  guestEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  guestTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
  guestSub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
    textAlign: 'center',
  },
  guestBtn: {
    marginTop: SIZES.xl,
    minWidth: 200,
  },
})
