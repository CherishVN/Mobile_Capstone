import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { orderService } from '@/services/order-service'
import { Order, OrderStatus, OrderStatusLabels, OrderStatusColors } from '@/types/order'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function OrderDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  const loadOrder = async () => {
    try {
      const response = await orderService.getOrderById(orderId)
      if (response.success && response.data) {
        setOrder(response.data)
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin đơn hàng')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = () => {
    Alert.alert('Hủy đơn hàng', 'Bạn có chắc muốn hủy đơn hàng này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true)
          try {
            await orderService.cancelOrder(orderId)
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

  const statusColor = OrderStatusColors[order.status]
  const canCancel = order.status === OrderStatus.Pending

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
              <Text style={[styles.statusText, { color: statusColor }]}>
                {order.statusName}
              </Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Đặt lúc: {formatDate(order.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Cửa hàng</Text>
          </View>
          <TouchableOpacity
            style={styles.shopCard}
            onPress={() => router.push(`/shop/${order.shopId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.shopName}>{order.shopName}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Sản phẩm</Text>
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={styles.productItem}>
              <Image
                source={{ uri: item.productImage || 'https://via.placeholder.com/60' }}
                style={styles.productImage}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.productName}
                </Text>
                {item.variantName && (
                  <Text style={styles.productVariant}>{item.variantName}</Text>
                )}
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{formatPrice(item.unitPrice)}</Text>
                  <Text style={styles.productQuantity}>x{item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          </View>
          <Text style={styles.addressText}>{order.shippingAddress}</Text>
        </View>

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

      {canCancel && (
        <View style={styles.footer}>
          <Button
            title="Hủy đơn hàng"
            onPress={handleCancelOrder}
            loading={cancelling}
            variant="outline"
            fullWidth
          />
        </View>
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
  },
  productItem: {
    flexDirection: 'row',
    gap: SIZES.md,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.background,
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
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
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
