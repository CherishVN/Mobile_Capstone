import React, { useEffect, useState, useRef, useCallback } from 'react'
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
  ImageBackground,
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
import { useNotificationStore } from '@/store/notification-store'

const { width } = Dimensions.get('window')

const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
    badge: 'Thời trang',
    badgeColor: '#ec7f13',
    title: 'Bộ sưu tập\nThời trang 2025',
    titleHighlight: 'Phong cách mới',
    desc: 'Cập nhật xu hướng thời trang hiện đại kết hợp nét truyền thống',
    cta: 'Mua ngay',
    btnColor: '#ec7f13',
    overlay: 'rgba(28, 14, 4, 0.58)',
  },
  {
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
    badge: 'Đặc sản vùng miền',
    badgeColor: '#9a734c',
    title: 'Tinh hoa\nẩm thực Việt',
    titleHighlight: 'Giao tận nhà',
    desc: 'Mùi vị chắt lọc từ những nguyên liệu tươi ngon và chất lượng nhất',
    cta: 'Đặt hàng',
    btnColor: '#9a734c',
    overlay: 'rgba(20, 12, 6, 0.60)',
  },
  {
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80',
    badge: 'Đồ thủ công',
    badgeColor: '#c47a2b',
    title: 'Nghệ thuật\nthủ công mỹ nghệ',
    titleHighlight: 'Độc đáo & Tinh xảo',
    desc: 'Sản phẩm từ những nghệ nhân tài ba, mang đậm bản sắc văn hóa',
    cta: 'Khám phá',
    btnColor: '#c47a2b',
    overlay: 'rgba(24, 12, 2, 0.55)',
  },
]

const SELLING_POINTS = [
  { icon: 'apps-outline', label: 'Đa dạng sản phẩm', sub: 'Hơn 20 loại sản phẩm' },
  { icon: 'shield-checkmark-outline', label: 'Hàng chính hãng', sub: 'Cam kết hoàn tiền' },
  { icon: 'refresh-circle-outline', label: 'Đổi trả dễ dàng', sub: 'Trong vòng 7 ngày' },
  { icon: 'headset-outline', label: 'Hỗ trợ 24/7', sub: 'Khiếu nại nhanh chóng' },
]

export default function HomeScreen() {
  const router = useRouter()
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [newProducts, setNewProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  const heroRef = useRef<FlatList>(null)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cartTotal = useCartStore((state) => state.cart?.items?.length || 0)
  const { isAuthenticated } = useAuthStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const loadData = async () => {
    try {
      const [featuredRes, newRes, categoriesRes] = await Promise.all([
        productService.getProducts({ sortBy: 'best_seller', pageSize: 12 }),
        productService.getProducts({ sortBy: 'newest', pageSize: 12 }),
        categoryService.getCategories(),
      ])

      setFeaturedProducts(featuredRes?.products || [])
      setNewProducts(newRes?.products || [])

      const categoryData = categoriesRes?.categories || []
      if (Array.isArray(categoryData)) {
        setCategories(
          categoryData
            .filter((c) => c.level === 1 && !c.parentId)
            .slice(0, 6)
        )
      } else {
        setCategories([])
      }
    } catch (error: any) {
      console.error('Failed to load home data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-play hero carousel (matching FE 4s interval)
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % HERO_SLIDES.length
        heroRef.current?.scrollToIndex({ index: next, animated: true })
        return next
      })
    }, 4000)
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current)
    }
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  if (loading) {
    return <Loading />
  }

  const renderHeroSlide = ({ item }: { item: typeof HERO_SLIDES[0] }) => (
    <View style={styles.heroSlideOuter}>
      <View style={styles.heroSlideWrapper}>
        <ImageBackground source={{ uri: item.image }} style={styles.heroSlideBg} imageStyle={{ borderRadius: 12 }}>
          <View style={[styles.heroOverlay, { backgroundColor: item.overlay }]} />
          <View style={styles.heroSlideContent}>
            <View style={[styles.heroBadge, { backgroundColor: item.badgeColor }]}>
              <Text style={styles.heroBadgeText}>{item.badge}</Text>
            </View>
            <Text style={styles.heroTitle}>{item.title}</Text>
            <Text style={styles.heroHighlight}>{item.titleHighlight}</Text>
            <Text style={styles.heroDesc}>{item.desc}</Text>

            <TouchableOpacity style={[styles.heroBtn, { backgroundColor: item.btnColor }]}>
              <Text style={styles.heroBtnText}>{item.cta}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </View>
    </View>
  )

  const catColWidth = (width - SIZES.lg * 2 - SIZES.sm * 2) / 3

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerBrandMark}>EcomViet</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              isAuthenticated
                ? router.push('/assistant' as Href)
                : router.push('/auth/login')
            }
          >
            <Ionicons name="sparkles-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              isAuthenticated
                ? router.push('/profile/notifications' as Href)
                : router.push('/auth/login')
            }
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => router.push('/cart')}
          >
            <Ionicons name="cart-outline" size={24} color={COLORS.text} />
            {cartTotal > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartTotal > 99 ? '99+' : cartTotal}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <TouchableOpacity
            style={styles.searchBox}
            onPress={() => router.push('/search')}
            activeOpacity={0.9}
          >
            <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.searchPlaceholder}>Tìm kiếm sản phẩm, danh mục...</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Carousel */}
        <View style={styles.heroSection}>
          <FlatList
            ref={heroRef}
            data={HERO_SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderHeroSlide}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width)
              setActiveSlide(index)
            }}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
          />
          <View style={styles.paginationDots}>
            {HERO_SLIDES.map((_, idx) => (
              <View key={idx} style={[styles.dot, activeSlide === idx && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Selling Points */}
        <View style={styles.sellingPointsWrap}>
          {SELLING_POINTS.map((sp, idx) => (
            <View key={idx} style={styles.sellingPointItem}>
              <Ionicons name={sp.icon as any} size={22} color={COLORS.primary} />
              <View style={styles.sellingPointTexts}>
                <Text style={styles.spLabel} numberOfLines={1}>{sp.label}</Text>
                <Text style={styles.spSub} numberOfLines={1}>{sp.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Danh mục nổi bật — Grid 3 columns (matching FE) */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionTitleIndicator} />
              <Text style={styles.sectionTitleMain}>Danh mục nổi bật</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push('/(tabs)/categories' as Href)}
            >
              <Text style={styles.seeAllText}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { width: catColWidth }]}
                onPress={() => router.push(`/products?categoryId=${cat.id}` as Href)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryImgWrap}>
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.categoryImg} />
                  ) : (
                    <View style={styles.categoryPlaceholder}>
                      <Ionicons name="pricetag" size={32} color={COLORS.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.categoryTextWrap}>
                  <Text style={styles.categoryName} numberOfLines={1}>{cat.name}</Text>
                  {(cat as any).productCount > 0 && (
                    <Text style={styles.categoryCount}>{(cat as any).productCount} sản phẩm</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sản phẩm nổi bật — Horizontal scroll (matching FE) */}
        {featuredProducts.length > 0 && (
          <View style={styles.featuredSection}>
            <View style={styles.featuredHeader}>
              <View style={styles.featuredHeaderLeft}>
                <Text style={styles.featuredTitle}>Sản phẩm nổi bật</Text>
                <View style={styles.featuredDivider} />
                <Text style={styles.featuredSub}>Được mua nhiều nhất</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => router.push('/products?sortBy=best_seller')}
              >
                <Text style={styles.seeAllText}>Xem tất cả</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SIZES.lg, gap: SIZES.md }}
              renderItem={({ item }) => (
                <View style={{ width: 170 }}>
                  <ProductCard product={item} onPress={() => router.push(`/products/${item.slug}`)} />
                </View>
              )}
            />
          </View>
        )}

        {/* Tất cả sản phẩm — Grid (matching FE) */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <View style={[styles.sectionTitleIndicator, { backgroundColor: COLORS.secondary }]} />
              <Text style={styles.sectionTitleMain}>Tất cả sản phẩm</Text>
            </View>
          </View>

          <View style={styles.productGridContainer}>
            {newProducts.map((product) => (
              <View key={product.id} style={styles.gridItemWrap}>
                <ProductCard
                  product={product}
                  onPress={() => router.push(`/products/${product.slug}`)}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.loadMoreBtn} onPress={() => router.push('/products?sortBy=newest')}>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  /* HEADER */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    backgroundColor: '#fff',
    paddingBottom: SIZES.sm,
  },
  headerBrandMark: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
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
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  /* SEARCH */
  searchSection: {
    backgroundColor: '#fff',
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: SIZES.md,
    height: 44,
    borderRadius: 22,
    gap: SIZES.sm,
  },
  searchPlaceholder: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
  },
  /* HERO */
  heroSection: {
    marginTop: SIZES.md,
    alignItems: 'center',
  },
  heroSlideOuter: {
    width: width,
    paddingHorizontal: SIZES.lg,
  },
  heroSlideWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroSlideBg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  heroSlideContent: {
    padding: SIZES.lg,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: SIZES.xs,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroHighlight: {
    color: '#ffd580',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  heroBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.sm,
    gap: 6,
  },
  dot: {
    height: 6,
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
  /* SELLING POINTS */
  sellingPointsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.lg,
    gap: SIZES.xs,
  },
  sellingPointItem: {
    width: (width - SIZES.lg * 2 - SIZES.xs) / 2,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.sm,
    borderRadius: 10,
    gap: SIZES.sm,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sellingPointTexts: {
    flex: 1,
  },
  spLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  spSub: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
  },
  /* SECTION */
  sectionWrap: {
    marginBottom: SIZES.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  sectionTitleIndicator: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  sectionTitleMain: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  /* CATEGORIES — Grid 3 cols (matching FE) */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.lg,
    gap: SIZES.sm,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryImgWrap: {
    aspectRatio: 1,
    backgroundColor: '#f5ede0',
    overflow: 'hidden',
  },
  categoryImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTextWrap: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  categoryCount: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  /* FEATURED — orange tint section (matching FE) */
  featuredSection: {
    backgroundColor: 'rgba(236,127,19,0.06)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(236,127,19,0.15)',
    paddingVertical: SIZES.lg,
    marginBottom: SIZES.lg,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
  },
  featuredHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    flex: 1,
  },
  featuredTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: -0.3,
  },
  featuredDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(236,127,19,0.3)',
  },
  featuredSub: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  /* GRID */
  productGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.lg,
    gap: SIZES.md,
  },
  gridItemWrap: {
    width: (width - SIZES.lg * 2 - SIZES.md) / 2,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SIZES.lg,
    marginTop: SIZES.lg,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
})
