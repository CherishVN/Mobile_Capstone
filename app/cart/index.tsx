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

export default function CartScreen() {
  const router = useRouter()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const updateCartStore = useCartStore((state) => state.setCart)

  const loadCart = async () => {
    try {
      const response = await cartService.getMyCart()
      if (response.success && response.data) {
        setCart(response.data)
        updateCartStore(response.data)
      }
    } catch (error: any) {
      console.error('Failed to load cart:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadCart()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadCart()
  }

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

  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa sản phẩm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await cartService.removeItem(itemId)
            await loadCart()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xóa sản phẩm')
          }
        },
      },
    ])
  }

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) return
    router.push('/checkout')
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  if (loading) {
    return <Loading />
  }

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.has(item.id)

    return (
      <View style={styles.cartItem}>
        <Image
          source={{ uri: item.productImage || 'https://via.placeholder.com/80' }}
          style={styles.itemImage}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.productName}
          </Text>
          {item.variantName && (
            <Text style={styles.itemVariant}>{item.variantName}</Text>
          )}
          <Text style={styles.itemPrice}>{formatPrice(item.unitPrice)}</Text>
          
          <View style={styles.itemFooter}>
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

            <TouchableOpacity onPress={() => handleRemoveItem(item.id)} disabled={isUpdating}>
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
      </View>

      {!cart || cart.items.length === 0 ? (
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
            data={cart.items}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />

          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính ({cart.totalItems} sản phẩm):</Text>
              <Text style={styles.summaryValue}>{formatPrice(cart.subtotal)}</Text>
            </View>
            <Button
              title="Thanh toán"
              onPress={handleCheckout}
              fullWidth
              size="lg"
            />
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
  listContent: {
    padding: SIZES.lg,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    gap: SIZES.md,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemVariant: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: FONTS.size.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'center',
  },
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
  footer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SIZES.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
  },
  summaryValue: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
})
