import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { categoryService } from '@/services/category-service'
import { Product } from '@/types/product'
import { Category } from '@/types/category'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'

const { width } = Dimensions.get('window')
const CATEGORY_CARD_WIDTH = 80

export default function HomeScreen() {
  const router = useRouter()
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newProducts, setNewProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const cartTotal = useCartStore((state) => state.getTotalItems())
  const { isAuthenticated } = useAuthStore()

  const loadData = async () => {
    try {
      const [featuredRes, newRes, categoriesRes] = await Promise.all([
        productService.getProducts({ sortBy: 'best_seller', pageSize: 6 }),
        productService.getProducts({ sortBy: 'newest', pageSize: 6 }),
        categoryService.getCategories(),
      ])

      setFeaturedProducts(featuredRes?.products || [])
      setNewProducts(newRes?.products || [])
      
      const categoryData = categoriesRes?.categories || []

      if (Array.isArray(categoryData)) {
        setCategories(
          categoryData
            .filter((c) => c.level === 1 && !c.parentId)
            .slice(0, 8)
        )
      } else {
        console.warn('Categories data is not an array:', categoryData)
        setCategories([])
      }
    } catch (error: any) {
      console.error('Failed to load home data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      setFeaturedProducts([])
      setNewProducts([])
      setCategories([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  if (loading) {
    return <Loading />
  }

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => router.push(`/products?categoryId=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.categoryIcon}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.categoryImage} />
        ) : (
          <Ionicons name="pricetag" size={28} color={COLORS.primary} />
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào!</Text>
          <Text style={styles.headerTitle}>Khám phá sản phẩm</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              isAuthenticated
                ? router.push('/assistant' as Href)
                : router.push('/auth/login')
            }
          >
            <Ionicons name="sparkles-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => router.push('/cart')}
          >
            <Ionicons name="cart-outline" size={28} color={COLORS.text} />
            {cartTotal > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartTotal}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.searchContainer}>
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push('/search')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.searchPlaceholder}>Tìm kiếm sản phẩm...</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danh mục</Text>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm nổi bật</Text>
            <TouchableOpacity onPress={() => router.push('/products?sortBy=best_seller')}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {featuredProducts.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductCard
                  product={product}
                  onPress={() => router.push(`/products/${product.slug}`)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm mới</Text>
            <TouchableOpacity onPress={() => router.push('/products?sortBy=newest')}>
              <Text style={styles.seeAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {newProducts.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <ProductCard
                  product={product}
                  onPress={() => router.push(`/products/${product.slug}`)}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    padding: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
  },
  greeting: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  headerIconBtn: {
    padding: SIZES.xs,
  },
  cartButton: {
    position: 'relative',
    padding: SIZES.xs,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.xs,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    gap: SIZES.sm,
  },
  searchPlaceholder: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SIZES.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoriesList: {
    paddingHorizontal: SIZES.lg,
    gap: SIZES.md,
  },
  categoryCard: {
    width: CATEGORY_CARD_WIDTH,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  categoryImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  categoryName: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    textAlign: 'center',
  },
  productGrid: {
    paddingHorizontal: SIZES.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.md,
  },
  productItem: {
    width: (width - SIZES.lg * 2 - SIZES.md) / 2,
  },
})
