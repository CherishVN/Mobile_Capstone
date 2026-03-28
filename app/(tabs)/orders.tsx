import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { orderService } from '@/services/order-service'
import { Order, OrderStatus, OrderStatusLabels, OrderStatusColors } from '@/types/order'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const ORDER_TABS = [
  { label: 'Tất cả', status: undefined },
  { label: 'Chờ xác nhận', status: OrderStatus.Pending },
  { label: 'Đang giao', status: OrderStatus.Shipping },
  { label: 'Hoàn thành', status: OrderStatus.Delivered },
]

export default function OrdersScreen() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const loadOrders = async () => {
    try {
      const status = ORDER_TABS[activeTab].status
      const response = await orderService.getMyOrders({
        status,
        pageSize: 50,
      })
      if (response.success && response.data) {
        setOrders(response.data)
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
  }, [activeTab])

  const onRefresh = () => {
    setRefreshing(true)
    loadOrders()
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusColor = OrderStatusColors[item.status]

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/orders/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderCode}>{item.orderCode}</Text>
            <Text style={styles.orderShop}>{item.shopName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.statusName}
            </Text>
          </View>
        </View>

        <View style={styles.orderItems}>
          {item.items.slice(0, 2).map((product, index) => (
            <Text key={index} style={styles.orderItemText} numberOfLines={1}>
              • {product.productName}
              {product.variantName && ` (${product.variantName})`} x{product.quantity}
            </Text>
          ))}
          {item.items.length > 2 && (
            <Text style={styles.orderItemText}>
              và {item.items.length - 2} sản phẩm khác
            </Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          <View style={styles.orderTotal}>
            <Text style={styles.totalLabel}>Tổng: </Text>
            <Text style={styles.totalValue}>{formatPrice(item.total)}</Text>
          </View>
        </View>
      </TouchableOpacity>
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

      <View style={styles.tabs}>
        {ORDER_TABS.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.tab, activeTab === index && styles.tabActive]}
            onPress={() => setActiveTab(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={orders}
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
    paddingBottom: SIZES.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.xs,
    paddingVertical: SIZES.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.background,
  },
  tabText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: SIZES.lg,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.md,
  },
  orderCode: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  orderShop: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
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
  orderItems: {
    marginBottom: SIZES.md,
  },
  orderItemText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SIZES.md,
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
})
