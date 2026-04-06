import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { favoriteService } from '@/services/favorite-service'
import { productService } from '@/services/product-service'
import { Product } from '@/types/product'
import { useAuthStore } from '@/store/auth-store'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const { width: winWidth } = Dimensions.get('window')
const FAV_CELL = (winWidth - SIZES.lg * 2 - SIZES.md) / 2

export default function FavoritesScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    if (!isAuthenticated) {
      setProducts([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const fav = await favoriteService.getFavoriteIds()
      const ids = fav.productIds || []
      const limited = ids.slice(0, 40)
      const results = await Promise.allSettled(
        limited.map((id) => productService.getProductById(id))
      )
      const list: Product[] = []
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.success && r.value.product) {
          const p = r.value.product
          list.push({
            id: p.id,
            slug: p.slug,
            name: p.name,
            shopId: p.shopId,
            shopName: p.shopName,
            shopSlug: p.shopSlug,
            basePrice: p.basePrice,
            currency: p.currency,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            imageUrls: p.imageUrls,
            createdAt: p.createdAt,
            soldCount: p.soldCount,
          })
        }
      }
      setProducts(list)
    } catch (e) {
      console.error('Favorites load error:', e)
      setProducts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yêu thích</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.hint}>Đăng nhập để xem sản phẩm đã lưu</Text>
          <Button title="Đăng nhập" onPress={() => router.replace('/auth/login')} />
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yêu thích</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={56} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có sản phẩm yêu thích</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ProductCard
              product={item}
              onPress={() => router.push(`/products/${item.slug}`)}
            />
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SIZES.xs, marginRight: SIZES.sm },
  headerTitle: { flex: 1, fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  headerRight: { width: 40 },
  list: { padding: SIZES.md, paddingBottom: SIZES.xxl },
  row: { justifyContent: 'space-between', gap: SIZES.md },
  cell: { width: FAV_CELL },
  empty: { alignItems: 'center', paddingVertical: SIZES.xxl * 2 },
  emptyText: { marginTop: SIZES.md, color: COLORS.textSecondary, fontSize: FONTS.size.md },
  center: { flex: 1, justifyContent: 'center', padding: SIZES.xl, gap: SIZES.lg },
  hint: { textAlign: 'center', color: COLORS.text, fontSize: FONTS.size.md },
})
