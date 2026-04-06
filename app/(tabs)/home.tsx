import React, { useEffect, useState, useRef } from 'react'
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

const { width } = Dimensions.get('window')

/* --- STATIC DATA MATCHING WEB --- */
const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
    badge: 'Ưu đãi hôm nay',
    badgeColor: '#ec7f13',
    title: 'Sale lớn\ncuối tuần',
    titleHighlight: 'Giảm đến 50%',
    desc: 'Hàng ngàn sản phẩm chính hãng\ngiao nhanh toàn quốc',
    cta: 'Mua ngay',
    btnColor: '#ec7f13',
    overlay: 'rgba(28, 14, 4, 0.58)',
  },
  {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
    badge: 'Hàng mới về',
    badgeColor: '#9a734c',
    title: 'Thời trang\nthu đông 2025',
    titleHighlight: 'Xu hướng mới',
    desc: 'Phong cách hiện đại\nkết hợp nét truyền thống Việt Nam',
    cta: 'Khám phá',
    btnColor: '#9a734c',
    overlay: 'rgba(20, 12, 6, 0.60)',
  },
  {
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
    badge: 'Đặc sản vùng miền',
    badgeColor: '#c47a2b',
    title: 'Tinh hoa\nẩm thực Việt',
    titleHighlight: 'Giao tận nhà',
    desc: 'Cà phê Đà Lạt, đặc sản Hội An, mắm Phú Quốc — chính gốc 100%',
    cta: 'Đặt hàng',
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

  const cartTotal = useCartStore((state) => state.cart?.items?.length || 0)
  const { isAuthenticated } = useAuthStore()

  const loadData = async () => {
    try {
      const [featuredRes, newRes, categoriesRes] = await Promise.all([
        productService.getProducts({ sortBy: 'best_seller', pageSize: 8 }),
        productService.getProducts({ sortBy: 'newest', pageSize: 10 }),
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

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  if (loading) {
    return <Loading />
  }

  /* --- RENDERERS --- */
  const renderHeroSlide = ({ item }: { item: typeof HERO_SLIDES[0] }) => (
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
  )

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.webStyleCategoryCard}
      onPress={() => router.push(`/search?categoryId=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.webStyleCategoryImgContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.webStyleCategoryImg} />
        ) : (
          <Ionicons name="pricetag" size={28} color={COLORS.textSecondary} />
        )}
      </View>
      <View style={styles.webStyleCategoryTextContainer}>
        <Text style={styles.webStyleCategoryName} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 1. Header Area Match Web */}
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
        {/* 2. Global Search Bar */}
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

        {/* 3. Hero Carousel */}
        <View style={styles.heroSection}>
           <FlatList 
             data={HERO_SLIDES}
             horizontal
             pagingEnabled
             showsHorizontalScrollIndicator={false}
             keyExtractor={(_, index) => index.toString()}
             renderItem={renderHeroSlide}
             onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / (width - SIZES.lg * 2))
                setActiveSlide(index)
             }}
           />
           <View style={styles.paginationDots}>
              {HERO_SLIDES.map((_, idx) => (
                 <View key={idx} style={[styles.dot, activeSlide === idx && styles.dotActive]} />
              ))}
           </View>
        </View>

        {/* 4. Selling Points Grid */}
        <View style={styles.sellingPointsWrap}>
           {SELLING_POINTS.map((sp, idx) => (
             <View key={idx} style={styles.sellingPointItem}>
                <Ionicons name={sp.icon as any} size={24} color={COLORS.primary} />
                <View style={styles.sellingPointTexts}>
                   <Text style={styles.spLabel} numberOfLines={1}>{sp.label}</Text>
                   <Text style={styles.spSub} numberOfLines={1}>{sp.sub}</Text>
                </View>
             </View>
           ))}
        </View>

        {/* 5. Categories (Web Style) */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
               <View style={styles.sectionTitleIndicator} />
               <Text style={styles.sectionTitleMain}>Danh mục nổi bật</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/search')}>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SIZES.lg, gap: SIZES.sm }}
          />
        </View>

        {/* 6. Flash Sales / Hot Products (Horizontal) */}
        {featuredProducts.length > 0 && (
          <View style={[styles.sectionWrap, styles.tintBgWrapper]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                 <Text style={[styles.sectionTitleMain, {color: COLORS.secondary}]}>Sản phẩm bán chạy</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/products?sortBy=best_seller')}>
                <Text style={styles.seeAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SIZES.lg, gap: SIZES.md }}
              renderItem={({item}) => (
                <View style={{ width: 160 }}>
                  <ProductCard product={item} onPress={() => router.push(`/products/${item.slug}`)} />
                </View>
              )}
            />
          </View>
        )}

        {/* 7. Newest Products (Grid) */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
               <View style={[styles.sectionTitleIndicator, {backgroundColor: COLORS.secondary}]} />
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
             <Text style={styles.loadMoreText}>Xem tất cả sản phẩm</Text>
             <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {/* Footer info padding */}
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
  heroSlideWrapper: {
    width: width - SIZES.lg * 2,
    height: 220,
    marginHorizontal: SIZES.lg,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  heroBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SIZES.sm,
    gap: 4,
  },
  dot: {
    height: 4,
    width: 6,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  dotActive: {
    width: 16,
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
    borderRadius: 8,
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
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  /* SECTION GLOBALS */
  sectionWrap: {
    marginBottom: SIZES.lg,
  },
  tintBgWrapper: {
    backgroundColor: 'rgba(236,127,19,0.06)',
    paddingVertical: SIZES.lg,
    marginTop: SIZES.md,
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
    gap: SIZES.xs,
  },
  sectionTitleIndicator: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  sectionTitleMain: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  /* CATEGORIES */
  webStyleCategoryCard: {
    width: 90,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webStyleCategoryImgContainer: {
    height: 70,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webStyleCategoryImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  webStyleCategoryTextContainer: {
    padding: 6,
    alignItems: 'center',
  },
  webStyleCategoryName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
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
    gap: 4,
    marginHorizontal: SIZES.lg,
    marginTop: SIZES.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
})
