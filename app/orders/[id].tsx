import React, { Fragment, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { orderService } from '@/services/order-service'
import { paymentService } from '@/services/payment-service'
import { cartService } from '@/services/cart-service'
import { Order, OrderStatus, OrderStatusStep, getOrderStatusColor, getOrderStatusLabelVi } from '@/types/order'
import ReviewModal from '@/components/ReviewModal'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import { markPendingPaymentOrder } from '@/lib/pending-payment'
import { startVnPayInAppSession } from '@/lib/vnpay-in-app'
import { startMoMoInAppSession } from '@/lib/momo-in-app'
import ProductReviewOrderModal from '@/components/ProductReviewOrderModal'
import ShopReviewOrderModal, {
  hasStoredShopReviewForOrder,
} from '@/components/ShopReviewOrderModal'

const REORDERABLE_STATUSES = new Set([5, 6, 7, 8])

/** Đồng bộ FE purchase + BE CustomerDisputeService */
const DISPUTE_WINDOW_DAYS = 7
const NOT_RECEIVED_MIN_DAYS_PROCESSING = 7
const NOT_RECEIVED_MIN_DAYS_SHIPPING = 5
const NOT_RECEIVED_DAYS_PAST_ETA = 3
const DISPUTE_ALLOWED_STATUSES = new Set<number>([OrderStatus.Delivered, OrderStatus.Completed])

function getReceiptAnchorDate(order: Order): Date {
  const deliveredStep = order.statusTimeline?.find((s) => s.value === 5)
  const completedStep = order.statusTimeline?.find((s) => s.value === 6)
  const candidates = [deliveredStep?.reachedAt, completedStep?.reachedAt]
    .filter(Boolean)
    .map((d) => new Date(d!).getTime())
  if (candidates.length > 0) return new Date(Math.min(...candidates))
  return new Date(order.updatedAt ?? order.createdAt)
}

function isPastEtaPlusDays(estimated: string | null | undefined, days: number) {
  if (!estimated) return false
  const etaMs = new Date(estimated).getTime()
  if (Number.isNaN(etaMs)) return false
  return Date.now() >= etaMs + days * 86400000
}

function computeDisputeEligibility(order: Order | null) {
  if (!order) {
    return { canDisputePostReceipt: false, canDisputeNotReceived: false }
  }
  const receiptAnchor = getReceiptAnchorDate(order)
  const canDisputePostReceipt =
    DISPUTE_ALLOWED_STATUSES.has(order.status) &&
    (Date.now() - receiptAnchor.getTime()) / 86400000 <= DISPUTE_WINDOW_DAYS

  let canDisputeNotReceived = false
  if (order.status === OrderStatus.Processing) {
    const step = order.statusTimeline?.find((s) => s.value === 3)
    const anchor = step?.reachedAt
      ? new Date(step.reachedAt).getTime()
      : new Date(order.updatedAt ?? order.createdAt).getTime()
    canDisputeNotReceived = (Date.now() - anchor) / 86400000 >= NOT_RECEIVED_MIN_DAYS_PROCESSING
  } else if (order.status === OrderStatus.Shipping) {
    const step = order.statusTimeline?.find((s) => s.value === 4)
    const anchor = step?.reachedAt
      ? new Date(step.reachedAt).getTime()
      : new Date(order.updatedAt ?? order.createdAt).getTime()
    if ((Date.now() - anchor) / 86400000 >= NOT_RECEIVED_MIN_DAYS_SHIPPING) {
      canDisputeNotReceived = true
    } else if (isPastEtaPlusDays(order.estimatedDeliveryDate, NOT_RECEIVED_DAYS_PAST_ETA)) {
      canDisputeNotReceived = true
    }
  } else if (order.status === OrderStatus.Delivered) {
    canDisputeNotReceived =
      (Date.now() - receiptAnchor.getTime()) / 86400000 <= DISPUTE_WINDOW_DAYS
  }
  return { canDisputePostReceipt, canDisputeNotReceived }
}

/** 7 bước giao hàng chính (0–6), đồng bộ web purchase/[id] */
const MAIN_TIMELINE_STEPS = [0, 1, 2, 3, 4, 5, 6] as const

type OrderStatusTimelineProps = {
  currentStatus: number
  statusTimeline: Order['statusTimeline']
}

function OrderStatusTimeline({ currentStatus, statusTimeline }: OrderStatusTimelineProps) {
  const isCancelled = currentStatus === OrderStatus.Cancelled
  const isRefunded = currentStatus === OrderStatus.Refunded
  const c = getOrderStatusColor(currentStatus)
  if (isCancelled || isRefunded) {
    const terminal = statusTimeline?.find((s) => s.value === currentStatus)
    return (
      <View
        style={[
          styles.timelineTerminal,
          { borderColor: c + '55', backgroundColor: c + '18' },
        ]}
      >
        <View style={styles.timelineTerminalRow}>
          <View style={[styles.timelineDot, { backgroundColor: c }]} />
          <Text style={[styles.timelineTerminalTitle, { color: c }]}>
            {getOrderStatusLabelVi(currentStatus)}
          </Text>
          <Text style={[styles.timelineTerminalSub, { color: c }]}>· Đơn hàng đã kết thúc</Text>
        </View>
        {terminal?.reachedAt ? (
          <Text style={styles.timelineTerminalTime}>{formatDateTimeStatic(terminal.reachedAt)}</Text>
        ) : null}
      </View>
    )
  }

  const fromApi = statusTimeline?.filter((s) => s.value >= 0 && s.value <= 6) ?? []
  if (fromApi.length > 0) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineScrollContent}
        style={styles.timelineScroll}
      >
        <View style={styles.timelineRow}>
          {fromApi.map((step, idx) => {
            const isDone = step.state === 'completed'
            const isCurrent = step.state === 'current'
            const showTime = (isDone || isCurrent) && step.reachedAt
            return (
              <Fragment key={step.value}>
                <View style={styles.timelineCol}>
                  <View
                    style={[
                      styles.timelineCircle,
                      isDone
                        ? styles.timelineCircleDone
                        : isCurrent
                          ? styles.timelineCircleCurrent
                          : styles.timelineCircleIdle,
                    ]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={styles.timelineCircleNum}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.timelineLabel,
                      isDone
                        ? styles.timelineLabelDone
                        : isCurrent
                          ? styles.timelineLabelCurrent
                          : styles.timelineLabelIdle,
                    ]}
                  >
                    {step.displayName || getOrderStatusLabelVi(step.value)}
                  </Text>
                  {showTime ? (
                    <Text style={styles.timelineTime} numberOfLines={2}>
                      {formatDateTimeStatic(step.reachedAt!)}
                    </Text>
                  ) : null}
                </View>
                {idx < fromApi.length - 1 ? (
                  <View
                    style={[
                      styles.timelineHLine,
                      isDone ? styles.timelineHLineDone : styles.timelineHLineIdle,
                    ]}
                  />
                ) : null}
              </Fragment>
            )
          })}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.timelineScrollContent}
      style={styles.timelineScroll}
    >
      <View style={styles.timelineRow}>
        {MAIN_TIMELINE_STEPS.map((step, idx) => {
          const isDone = currentStatus > step
          const isCurrent = currentStatus === step
          const label = getOrderStatusLabelVi(step)
          return (
            <Fragment key={step}>
              <View style={styles.timelineCol}>
                <View
                  style={[
                    styles.timelineCircle,
                    isDone
                      ? styles.timelineCircleDone
                      : isCurrent
                        ? styles.timelineCircleCurrent
                        : styles.timelineCircleIdle,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Text style={styles.timelineCircleNum}>{idx + 1}</Text>
                  )}
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.timelineLabel,
                    isDone
                      ? styles.timelineLabelDone
                      : isCurrent
                        ? styles.timelineLabelCurrent
                        : styles.timelineLabelIdle,
                  ]}
                >
                  {label}
                </Text>
              </View>
              {idx < MAIN_TIMELINE_STEPS.length - 1 ? (
                <View
                  style={[
                    styles.timelineHLine,
                    isDone ? styles.timelineHLineDone : styles.timelineHLineIdle,
                  ]}
                />
              ) : null}
            </Fragment>
          )
        })}
      </View>
    </ScrollView>
  )
}

function formatDateTimeStatic(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

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
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null)
  const [shopReviewStored, setShopReviewStored] = useState(false)
  const [productReviewOpen, setProductReviewOpen] = useState(false)
  const [shopReviewOpen, setShopReviewOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const onRefresh = async () => {
    if (!orderId) return
    setRefreshing(true)
    try {
      const response = await orderService.getOrderById(orderId)
      if (response.success && response.order) {
        setOrder(response.order)
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể làm mới')
    } finally {
      setRefreshing(false)
    }
  }

  const disputeEligibility = useMemo(() => computeDisputeEligibility(order), [order])

  const openCancelModal = () => {
    setCancelReason('')
    setCancelModalVisible(true)
  }

  const submitCancel = async () => {
    if (!order) return
    setCancelling(true)
    setCancelModalVisible(false)
    try {
      const reason = cancelReason.trim() || undefined
      if (order.status === 0) {
        await orderService.cancelPendingOrder(orderId, reason)
      } else {
        await orderService.cancelOrder(orderId, reason)
      }
      const isPaid = order.status !== 0
      Alert.alert(
        'Đã hủy đơn',
        isPaid
          ? 'Đơn hàng đã được hủy. Số tiền sẽ được hoàn lại vào ví của bạn trong vài phút.'
          : 'Đơn hàng đã được hủy thành công.',
      )
      await loadOrder()
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể hủy đơn hàng')
    } finally {
      setCancelling(false)
    }
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
        const momoRes = await startMoMoInAppSession(orderId)
        if (momoRes.kind === 'error') {
          Alert.alert('Lỗi', momoRes.message || 'Không tạo được link thanh toán')
        } else {
          await markPendingPaymentOrder(orderId)
        }
        await loadOrder()
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

  const formatDateTime = (dateString: string) => {
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
  const canCancelOrder =
    order.status === OrderStatus.PendingConfirmation ||
    order.status === OrderStatus.Confirmed ||
    order.status === OrderStatus.Processing
  const canCancel = canCancelPending || canCancelOrder
  const canPay = order.status === OrderStatus.PendingPayment
  const canConfirmReceive = order.status === OrderStatus.Delivered
  const canReorder = REORDERABLE_STATUSES.has(order.status)
  const { canDisputePostReceipt, canDisputeNotReceived } = disputeEligibility
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
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.headerRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="refresh" size={22} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderCode}>{order.orderCode}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{order.statusName}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Đặt lúc: {formatDateTime(order.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="git-network-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Trạng thái xử lý</Text>
          </View>
          <OrderStatusTimeline
            currentStatus={order.status}
            statusTimeline={order.statusTimeline}
          />
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

        {/* Thông tin giao hàng (khớp web) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
          </View>
          <Text style={styles.shipName}>
            {order.shipFullName?.trim() || 'Không có thông tin người nhận'}
          </Text>
          {order.shipPhone ? (
            <Text style={styles.shipPhone} selectable>
              {order.shipPhone}
            </Text>
          ) : (
            <Text style={styles.shipPhoneMuted}>Chưa có số điện thoại</Text>
          )}
          <Text style={styles.shipAddress}>
            {order.shipAddress?.trim() || order.shippingAddress || 'Chưa có địa chỉ giao hàng'}
          </Text>

          {(order.actualDeliveryDate || order.estimatedDeliveryDate || order.trackingCode) && (
            <View style={styles.logisticsBox}>
              {order.actualDeliveryDate ? (
                <View style={styles.logisticsRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.logisticsTextDone}>
                    Đã giao lúc{' '}
                    <Text style={styles.logisticsEmphasis}>
                      {formatDateTime(order.actualDeliveryDate)}
                    </Text>
                  </Text>
                </View>
              ) : order.estimatedDeliveryDate ? (
                <View style={styles.logisticsRow}>
                  <Ionicons name="bus-outline" size={18} color="#1d4ed8" />
                  <Text style={styles.logisticsTextEta}>
                    Dự kiến giao{' '}
                    <Text style={styles.logisticsEmphasis}>
                      {formatDateShort(order.estimatedDeliveryDate)}
                    </Text>
                  </Text>
                </View>
              ) : null}
              {order.trackingCode ? (
                <View style={styles.logisticsRow}>
                  <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.logisticsTracking}>
                    Mã vận đơn:{' '}
                    <Text style={styles.logisticsMono}>{order.trackingCode}</Text>
                    {order.shippingProvider ? (
                      <Text style={styles.logisticsProvider}> ({order.shippingProvider})</Text>
                    ) : null}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Cancel reason */}
        {order.cancelReason && (order.status === OrderStatus.Cancelled || order.status === OrderStatus.Refunded) && (
          <View style={[styles.section, styles.cancelReasonSection]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Lý do hủy</Text>
            </View>
            <Text style={styles.cancelReasonText}>{order.cancelReason}</Text>
          </View>
        )}

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

      {/* Footer actions — phải gồm khiếu nại: nếu không, đơn Đang giao không có nút nào khác nên cả footer bị ẩn */}
  {(canPay ||
    canCancel ||
    canConfirmReceive ||
    canReview ||
    canReorder ||
    showReviewActions ||
    canDisputePostReceipt ||
    canDisputeNotReceived) && (
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
          title={reordering ? 'Đang thêm...' : 'Mua lại'}
          onPress={handleReorder}
          loading={reordering}
          variant="outline"
          fullWidth
          size="lg"
        />
      )}
      {canCancel && (
        <Button
          title={cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}
          onPress={openCancelModal}
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
      {canDisputePostReceipt && (
        <Button
          title="Khiếu nại đơn hàng"
          onPress={() => router.push(`/profile/disputes?orderId=${order.id}` as any)}
          variant="outline"
          fullWidth
        />
      )}
      {canDisputeNotReceived && (
        <Button
          title="Báo không nhận được hàng"
          onPress={() =>
            router.push(`/profile/disputes?orderId=${order.id}&defaultType=notReceived` as any)
          }
          variant="outline"
          fullWidth
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

      {/* Cancel order modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setCancelModalVisible(false)}
          />
          <View style={styles.modalBox}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Hủy đơn hàng</Text>
              {canCancelOrder && (
                <View style={styles.refundNotice}>
                  <Ionicons name="wallet-outline" size={16} color="#16A34A" />
                  <Text style={styles.refundNoticeText}>
                    Tiền sẽ được hoàn lại vào ví của bạn sau khi hủy.
                  </Text>
                </View>
              )}
              <Text style={styles.modalLabel}>Lý do hủy (không bắt buộc)</Text>
              <TextInput
                style={styles.cancelReasonInput}
                placeholder="Ví dụ: Tôi đổi địa chỉ nhận hàng..."
                placeholderTextColor={COLORS.placeholder}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
                autoCorrect={false}
                spellCheck={false}
                disableFullscreenUI={Platform.OS === 'android'}
              />
              <Text style={styles.charCount}>{cancelReason.length}/500</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnOutline}
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.modalBtnOutlineText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDestructive}
                onPress={submitCancel}
              >
                <Text style={styles.modalBtnDestructiveText}>Xác nhận hủy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    flex: 1,
    textAlign: 'center',
  },
  headerRefresh: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  timelineScroll: {
    marginHorizontal: -SIZES.lg,
  },
  timelineScrollContent: {
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineCol: {
    width: 76,
    alignItems: 'center',
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleDone: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  timelineCircleCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timelineCircleIdle: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  timelineCircleNum: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    minHeight: 28,
  },
  timelineLabelDone: {
    color: '#059669',
  },
  timelineLabelCurrent: {
    color: COLORS.primary,
  },
  timelineLabelIdle: {
    color: COLORS.textSecondary,
    opacity: 0.6,
  },
  timelineTime: {
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  timelineHLine: {
    width: 20,
    height: 2,
    marginTop: 15,
    borderRadius: 1,
  },
  timelineHLineDone: {
    backgroundColor: '#6ee7b7',
  },
  timelineHLineIdle: {
    backgroundColor: COLORS.border,
  },
  timelineTerminal: {
    borderWidth: 1,
    borderRadius: 12,
    padding: SIZES.md,
  },
  timelineTerminalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineTerminalTitle: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  timelineTerminalSub: {
    fontSize: FONTS.size.xs,
    opacity: 0.85,
  },
  timelineTerminalTime: {
    fontSize: FONTS.size.xs,
    marginTop: 4,
    opacity: 0.9,
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
  shipName: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  shipPhone: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  shipPhoneMuted: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  shipAddress: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  logisticsBox: {
    marginTop: SIZES.md,
    padding: SIZES.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: 'rgba(219, 234, 254, 0.45)',
    gap: 8,
  },
  logisticsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  logisticsTextDone: {
    fontSize: FONTS.size.sm,
    color: '#047857',
    flex: 1,
  },
  logisticsTextEta: {
    fontSize: FONTS.size.sm,
    color: '#1d4ed8',
    flex: 1,
  },
  logisticsEmphasis: {
    fontWeight: '700',
  },
  logisticsTracking: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  logisticsMono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  logisticsProvider: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
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
    paddingBottom: 34,
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
  cancelReasonSection: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  cancelReasonText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SIZES.lg,
    paddingBottom: SIZES.xxl,
  },
  modalTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  refundNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  refundNoticeText: {
    fontSize: FONTS.size.sm,
    color: '#16A34A',
    flex: 1,
  },
  modalLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  cancelReasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: SIZES.md,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    minHeight: 100,
    backgroundColor: COLORS.card,
  },
  charCount: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: SIZES.xs,
    marginBottom: SIZES.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  modalBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  modalBtnOutlineText: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalBtnDestructive: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  modalBtnDestructiveText: {
    fontSize: FONTS.size.md,
    color: '#fff',
    fontWeight: '600',
  },
})
