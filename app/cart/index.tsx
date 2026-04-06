import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { cartService } from '@/services/cart-service'
import { Cart, CartItem } from '@/types/cart'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CHECKOUT_SELECTED_IDS_KEY = 'checkout:selected-item-ids'

export default function CartScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const updateCartStore = useCartStore((state) => state.setCart)

  const loadCart = async () => {
    try {
      const response = await cartService.getMyCart()
      if (response.success && response.data) {
        setCart(response.data)
        updateCartStore(response.data)
        // Auto-select all items on first load
        setSelectedIds(new Set(response.data.items.map((i) => i.id)))
      }
    } catch (error: any) {
      console.error('Failed to load cart:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setCart(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadCart()
  }, [isAuthenticated])

  const onRefresh = () => {
    setRefreshing(true)
    loadCart()
  }

  /* ── Selection ── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (!cart) return
    if (selectedIds.size === cart.items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(cart.items.map((i) => i.id)))
    }
  }

  /* ── Quantity ── */
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setUpdatingItems((prev) => new Set(prev).add(itemId))
    try {
      await cartService.updateItem(itemId, { quantity: newQuantity })
      await loadCart()
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể cập nhật số lượng')
    } finally {
      setUpdatingItems((prev) => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  /* ── Remove ── */
  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa sản phẩm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await cartService.removeItem(itemId)
            setSelectedIds((prev) => {
              const s = new Set(prev)
              s.delete(itemId)
              return s
            })
            await loadCart()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xóa sản phẩm')
          }
        },
      },
    ])
  }

  const handleRemoveSelected = () => {
    if (selectedIds.size === 0) return
    Alert.alert('Xác nhận', `Xóa ${selectedIds.size} sản phẩm đã chọn?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          for (const id of selectedIds) {
            try {
              await cartService.removeItem(id)
            } catch {}
          }
          setSelectedIds(new Set())
          await loadCart()
        },
      },
    ])
  }

  /* ── Checkout ── */
  const handleCheckout = async () => {
    if (!isAuthenticated) {
      Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thanh toán.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/auth/login') },
      ])
      return
    }
    if (!cart || selectedIds.size === 0) return

    // Save selected IDs for checkout page
    try {
      await AsyncStorage.setItem(
        CHECKOUT_SELECTED_IDS_KEY,
        JSON.stringify(Array.from(selectedIds))
      )
    } catch {
      // fallback — checkout page will use all items
    }
    router.push('/checkout')
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price)

  const items = cart?.items ?? []
  const selectedTotal = items
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.lineTotal, 0)
  const selectedCount = items
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.quantity, 0)

  if (loading && isAuthenticated) {
    return <Loading />
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
        </View>
        <View style={styles.guestEmpty}>
          <Ionicons name="cart-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Đăng nhập để xem giỏ hàng</Text>
          <Text style={styles.emptySubtext}>Sản phẩm bạn thêm sẽ hiển thị tại đây.</Text>
          <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.guestBtn} />
        </View>
      </View>
    )
  }

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.has(item.id)
    const isSelected = selectedIds.has(item.id)

    return (
      <View style={styles.cartItem}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleSelect(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>

        {/* Product image */}
        <Image
          source={{ uri: item.productImage || 'https://via.placeholder.com/80' }}
          style={styles.itemImage}
        />

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.productName}
          </Text>
          {item.variantName && (
            <Text style={styles.itemVariant}>Phân loại: {item.variantName}</Text>
          )}
          <Text style={styles.itemPrice}>{formatPrice(item.unitPrice)}</Text>

          <View style={styles.itemFooter}>
            {/* Quantity controls */}
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                disabled={isUpdating || item.quantity <= 1}
              >
                <Ionicons
                  name="remove"
                  size={16}
                  color={item.quantity <= 1 ? COLORS.placeholder : COLORS.text}
                />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= item.stockAvailable}
              >
                <Ionicons
                  name="add"
                  size={16}
                  color={item.quantity >= item.stockAvailable ? COLORS.placeholder : COLORS.text}
                />
              </TouchableOpacity>
            </View>

            {/* Line total + delete */}
            <View style={styles.itemActions}>
              <Text style={styles.lineTotal}>{formatPrice(item.lineTotal)}</Text>
              <TouchableOpacity onPress={() => handleRemoveItem(item.id)} disabled={isUpdating}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
      </View>

      {!cart || items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Giỏ hàng trống</Text>
          <Text style={styles.emptySubtext}>Thêm sản phẩm vào giỏ hàng để mua sắm</Text>
          <Button
            title="Khám phá sản phẩm"
            onPress={() => router.push('/(tabs)/home')}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />

          {/* Footer with select all + summary */}
          <View style={styles.footer}>
            <View style={styles.footerTop}>
              <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
                <Ionicons
                  name={
                    selectedIds.size === items.length && items.length > 0
                      ? 'checkbox'
                      : 'square-outline'
                  }
                  size={22}
                  color={
                    selectedIds.size === items.length && items.length > 0
                      ? COLORS.primary
                      : COLORS.textSecondary
                  }
                />
                <Text style={styles.selectAllText}>Tất cả ({items.length})</Text>
              </TouchableOpacity>

              {selectedIds.size > 0 && (
                <TouchableOpacity onPress={handleRemoveSelected}>
                  <Text style={styles.deleteSelectedText}>Xóa ({selectedIds.size})</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>
                  Tổng ({selectedCount} sản phẩm):
                </Text>
                <Text style={styles.summaryValue}>{formatPrice(selectedTotal)}</Text>
              </View>
              <Button
                title="Mua Hàng"
                onPress={handleCheckout}
                disabled={selectedIds.size === 0}
                size="lg"
                style={styles.checkoutBtn}
              />
            </View>
          </View>
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
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SIZES.md,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  listContent: {
    padding: SIZES.md,
  },
  /* Cart item */
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    gap: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkbox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemVariant: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quantityText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 28,
    textAlign: 'center',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  lineTotal: {
    fontSize: FONTS.size.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  /* Footer */
  footer: {
    padding: SIZES.md,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SIZES.sm,
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  selectAllText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  deleteSelectedText: {
    fontSize: FONTS.size.sm,
    color: COLORS.error,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  checkoutBtn: {
    minWidth: 130,
  },
  /* Empty */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
  },
  emptyText: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
  },
  emptySubtext: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: SIZES.lg,
  },
  guestEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  guestBtn: {
    marginTop: SIZES.lg,
    minWidth: 200,
  },
})
