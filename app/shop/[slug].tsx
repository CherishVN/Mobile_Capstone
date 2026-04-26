import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native'
import { useRouter, useLocalSearchParams, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { shopService } from '@/services/shop-service'
import { Shop, ShopCategoryDto } from '@/types/shop'
import { Product } from '@/types/product'
import { mapShopPublicToShop } from '@/utils/shop-mapper'
import { formatCompactNumber, formatJoinTime } from '@/utils/formatters-shop'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import { conversationService } from '@/services/conversation-service'
import { reviewService } from '@/services/review-service'
import type { ShopReview } from '@/types/review'

const { width } = Dimensions.get('window')

const PAGE_SIZE = 20
const MAX_VISIBLE_CATS = 4

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'best_selling', label: 'Bán chạy' },
  { value: 'price_asc', label: 'Giá thấp → cao' },
  { value: 'price_desc', label: 'Giá cao → thấp' },
]

export default function ShopDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const slug = params.slug as string
  const { isAuthenticated } = useAuthStore()

  const [shop, setShop] = useState<Shop | null>(null)
  const [categories, setCategories] = useState<ShopCategoryDto[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [catModalVisible, setCatModalVisible] = useState(false)

  const loadShopProfile = useCallback(async () => {
    try {
      const shopRes = await shopService.getShopBySlug(slug)
      if (!shopRes.success || !shopRes.shop) {
        setShop(null)
        setCategories([])
        return
      }
      const mapped = mapShopPublicToShop(shopRes.shop)
      setShop(mapped)
      const [catRes, revRes] = await Promise.all([
        shopService.getShopCategories(mapped.id).catch(() => null),
        reviewService.getShopReviews(mapped.id, { pageSize: 8, sortBy: 'newest' }).catch(() => null),
      ])
      if (catRes?.success) {
        setCategories(catRes.categories || [])
      } else {
        setCategories([])
      }
      setShopReviews(revRes?.success ? revRes.reviews || [] : [])
    } catch {
      setShop(null)
    }
  }, [slug])

  const loadProducts = useCallback(async () => {
    if (!shop) return
    setLoadingProducts(true)
    try {
      const res = await shopService.getShopProducts(shop.id, {
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        categoryId: activeCategoryId,
      })
      setProducts(res.products || [])
      setTotalCount(res.totalCount ?? 0)
    } catch {
      setProducts([])
      setTotalCount(0)
    } finally {
      setLoadingProducts(false)
    }
  }, [shop, page, sortBy, activeCategoryId])

  useEffect(() => {
    setPage(1)
    setActiveCategoryId(null)
    setSortBy('newest')
    setProducts([])
    setTotalCount(0)
    setCategories([])
    setLoading(true)
    void (async () => {
      await loadShopProfile()
      setLoading(false)
    })()
  }, [slug, loadShopProfile])

  useEffect(() => {
    if (!shop) return
    void loadProducts()
  }, [shop, loadProducts])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const shopRes = await shopService.getShopBySlug(slug)
      if (!shopRes.success || !shopRes.shop) return
      const mapped = mapShopPublicToShop(shopRes.shop)
      setShop(mapped)
      const catRes = await shopService.getShopCategories(mapped.id).catch(() => null)
      if (catRes?.success) {
        setCategories(catRes.categories || [])
      }
      const [prodRes, revRes] = await Promise.all([
        shopService.getShopProducts(mapped.id, {
          page,
          pageSize: PAGE_SIZE,
          sortBy,
          categoryId: activeCategoryId,
        }),
        reviewService.getShopReviews(mapped.id, { pageSize: 8, sortBy: 'newest' }).catch(() => null),
      ])
      setProducts(prodRes.products || [])
      setTotalCount(prodRes.totalCount ?? 0)
      setShopReviews(revRes?.success ? revRes.reviews || [] : [])
    } finally {
      setRefreshing(false)
    }
  }, [slug, page, sortBy, activeCategoryId])

  const selectCategory = (id: number | null) => {
    setActiveCategoryId(id)
    setPage(1)
    setCatModalVisible(false)
  }

  const selectSort = (value: string) => {
    setSortBy(value)
    setPage(1)
  }

  if (loading) {
    return <Loading />
  }

  if (!shop) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy cửa hàng</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.errorLink}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const visibleCats = categories.slice(0, MAX_VISIBLE_CATS)
  const overflowCats = categories.slice(MAX_VISIBLE_CATS)

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }
    setFollowBusy(true)
    try {
      if (shop.isFollowing) {
        const r = await shopService.unfollowShop(shop.id)
        if (r.success !== false) {
          setShop((s) =>
            s
              ? {
                  ...s,
                  isFollowing: false,
                  followerCount: Math.max(0, s.followerCount - 1),
                }
              : s
          )
        }
      } else {
        const r = await shopService.followShop(shop.id)
        if (r.success !== false) {
          setShop((s) =>
            s
              ? {
                  ...s,
                  isFollowing: true,
                  followerCount: s.followerCount + 1,
                }
              : s
          )
        }
      }
    } catch (e: any) {
      Alert.alert('Cửa hàng', e?.message || 'Không cập nhật được theo dõi')
    } finally {
      setFollowBusy(false)
    }
  }

  const openShopChat = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }
    setOpeningChat(true)
    try {
      const conv = await conversationService.startOrGet({ shopId: shop.id })
      router.push(`/messages/${conv.id}` as Href)
    } catch (e: any) {
      Alert.alert('Chat', e?.message || 'Không mở được cuộc trò chuyện')
    } finally {
      setOpeningChat(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <View style={styles.coverSection}>
          {shop.coverImage ? (
            <Image source={{ uri: shop.coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.background} />
          </TouchableOpacity>

          <View style={styles.shopInfoCard}>
            {shop.logo ? (
              <Image source={{ uri: shop.logo }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="storefront" size={32} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.shopInfo}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.chatShopBtn, styles.actionHalf]}
                  onPress={openShopChat}
                  disabled={openingChat}
                  activeOpacity={0.8}
                >
                  {openingChat ? (
                    <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  ) : (
                    <>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={16}
                        color={COLORS.onPrimary}
                      />
                      <Text style={styles.chatShopBtnText}>Chat</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    shop.isFollowing && styles.followBtnActive,
                    styles.actionHalf,
                  ]}
                  onPress={toggleFollow}
                  disabled={followBusy}
                  activeOpacity={0.8}
                >
                  {followBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={shop.isFollowing ? COLORS.onPrimary : COLORS.primary}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={shop.isFollowing ? 'heart' : 'heart-outline'}
                        size={18}
                        color={shop.isFollowing ? COLORS.onPrimary : COLORS.primary}
                      />
                      <Text
                        style={[
                          styles.followBtnText,
                          shop.isFollowing && styles.followBtnTextActive,
                        ]}
                      >
                        {shop.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* 4 thẻ thống kê — giống web */}
        <View style={styles.statsGrid}>
          <StatMini
            icon="cube-outline"
            label="Sản phẩm"
            value={formatCompactNumber(shop.productCount)}
          />
          <StatMini
            icon="people-outline"
            label="Người theo dõi"
            value={formatCompactNumber(shop.followerCount)}
          />
          <StatMini
            icon="star"
            label="Đánh giá"
            value={`${shop.averageRating.toFixed(1)} (${formatCompactNumber(shop.reviewCount)})`}
            iconColor="#f59c2a"
          />
          <StatMini
            icon="calendar-outline"
            label="Tham gia"
            value={formatJoinTime(shop.createdAt, { unknownLabel: 'Chưa cập nhật', textCase: 'title' })}
          />
        </View>

        {shop.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giới thiệu</Text>
            <Text style={styles.description}>{shop.description}</Text>
          </View>
        ) : null}

        {/* Danh mục + sắp xếp — giống web */}
        <View style={[styles.section, styles.filterSection]}>
          <Text style={styles.filterHeading}>Sản phẩm theo shop</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <Chip
              label="Tất cả"
              active={activeCategoryId === null}
              onPress={() => selectCategory(null)}
            />
            {visibleCats.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                sub={`${cat.productCount}`}
                active={activeCategoryId === cat.id}
                onPress={() => selectCategory(cat.id)}
              />
            ))}
            {overflowCats.length > 0 ? (
              <TouchableOpacity
                style={styles.moreChip}
                onPress={() => setCatModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.moreChipText}>Thêm +</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.sortScroll}
          >
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
                onPress={() => selectSort(opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortBy === opt.value && styles.sortChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loadingProducts ? (
            <View style={styles.productsLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="cube-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyProductsText}>Chưa có sản phẩm nào</Text>
            </View>
          ) : (
            <>
              <Text style={styles.productCountHint}>
                Hiển thị {products.length} / {totalCount} sản phẩm
                {totalPages > 1 ? ` · Trang ${page}/${totalPages}` : ''}
              </Text>
              <View style={styles.productGrid}>
                {products.map((product) => (
                  <View key={product.id} style={styles.productItem}>
                    <ProductCard
                      product={product}
                      onPress={() => router.push(`/products/${product.slug}`)}
                    />
                  </View>
                ))}
              </View>
              {totalPages > 1 ? (
                <View style={styles.pagerRow}>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <Text style={styles.pagerBtnText}>Trước</Text>
                  </TouchableOpacity>
                  <Text style={styles.pagerInfo}>
                    {page} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <Text style={styles.pagerBtnText}>Sau</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đánh giá từ khách ({shop.reviewCount})</Text>
          {shopReviews.length === 0 ? (
            <Text style={styles.reviewsEmpty}>Chưa có đánh giá hiển thị.</Text>
          ) : (
            shopReviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewUser} numberOfLines={1}>
                    {r.userName || 'Khách hàng'}
                  </Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= r.rating ? 'star' : 'star-outline'}
                        size={14}
                        color="#f59c2a"
                      />
                    ))}
                  </View>
                </View>
                {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
                {r.content ? <Text style={styles.reviewContent}>{r.content}</Text> : null}
                <Text style={styles.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={catModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCatModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCatModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Chọn danh mục</Text>
            <ScrollView>
              {overflowCats.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.modalCatItem}
                  onPress={() => selectCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.modalCatName,
                      activeCategoryId === cat.id && styles.modalCatNameActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                  <Text style={styles.modalCatCount}>{cat.productCount}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setCatModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function StatMini({
  icon,
  label,
  value,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  iconColor?: string
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statCardIcon}>
        <Ionicons name={icon} size={18} color={iconColor || '#b8860b'} />
      </View>
      <View style={styles.statCardTextCol}>
        <Text style={styles.statCardLabel}>{label}</Text>
        <Text style={styles.statCardValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  )
}

function Chip({
  label,
  sub,
  active,
  onPress,
}: {
  label: string
  sub?: string
  active: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? <Text style={styles.chipSub}>{sub}</Text> : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  coverSection: {
    position: 'relative',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
  coverPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    position: 'absolute',
    top: SIZES.xxl + 10,
    left: SIZES.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopInfoCard: {
    position: 'absolute',
    bottom: -40,
    left: SIZES.lg,
    right: SIZES.lg,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SIZES.md,
    flexDirection: 'row',
    gap: SIZES.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: FONTS.size.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  actionHalf: {
    flex: 1,
    minWidth: 0,
  },
  chatShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: SIZES.sm,
    borderRadius: 10,
    minHeight: 40,
  },
  chatShopBtnText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: SIZES.sm,
    borderRadius: 10,
    minHeight: 40,
  },
  followBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  followBtnText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  followBtnTextActive: {
    color: COLORS.onPrimary,
  },
  statsGrid: {
    marginTop: 52,
    paddingHorizontal: SIZES.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  statCard: {
    width: (width - SIZES.lg * 2 - SIZES.sm) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SIZES.md,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  statCardLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'none',
  },
  statCardValue: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  section: {
    padding: SIZES.lg,
    marginTop: SIZES.md,
  },
  filterSection: {
    backgroundColor: COLORS.card,
    marginTop: SIZES.sm,
    borderRadius: 0,
  },
  filterHeading: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  sortScroll: {
    marginTop: SIZES.sm,
    marginBottom: SIZES.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    maxWidth: 160,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.onPrimary,
  },
  chipSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  moreChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    marginRight: 6,
  },
  sortChipActive: {
    backgroundColor: '#3d2e1f',
  },
  sortChipText: {
    fontSize: 12,
    color: '#8b7355',
  },
  sortChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  productCountHint: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  productsLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyProducts: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyProductsText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.lg,
    marginTop: SIZES.lg,
  },
  pagerBtn: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pagerBtnDisabled: {
    opacity: 0.4,
  },
  pagerBtnText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  pagerInfo: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  description: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.md,
  },
  productItem: {
    width: (width - SIZES.lg * 2 - SIZES.md) / 2,
  },
  reviewsEmpty: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  reviewCard: {
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  reviewUser: {
    flex: 1,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewTitle: {
    marginTop: SIZES.xs,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewContent: {
    marginTop: 4,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  reviewDate: {
    marginTop: SIZES.xs,
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.lg,
  },
  errorText: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
  },
  errorLink: {
    marginTop: SIZES.md,
    color: COLORS.primary,
    fontSize: FONTS.size.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SIZES.lg,
  },
  modalBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: SIZES.md,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    marginBottom: SIZES.sm,
    color: COLORS.text,
  },
  modalCatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCatName: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  modalCatNameActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalCatCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  modalClose: {
    marginTop: SIZES.md,
    alignItems: 'center',
  },
  modalCloseText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
})
