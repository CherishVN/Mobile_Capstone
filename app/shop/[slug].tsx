import React, { useEffect, useState } from 'react'
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
} from 'react-native'
import { useRouter, useLocalSearchParams, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { shopService } from '@/services/shop-service'
import { Shop } from '@/types/shop'
import { Product } from '@/types/product'
import { mapShopPublicToShop } from '@/utils/shop-mapper'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import { conversationService } from '@/services/conversation-service'
import { reviewService } from '@/services/review-service'
import type { ShopReview } from '@/types/review'

const { width } = Dimensions.get('window')

export default function ShopDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const slug = params.slug as string
  const { isAuthenticated } = useAuthStore()

  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([])
  const [loading, setLoading] = useState(true)
  const [openingChat, setOpeningChat] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    loadShopData()
  }, [slug])

  const loadShopData = async () => {
    try {
      const shopRes = await shopService.getShopBySlug(slug)
      if (!shopRes.success || !shopRes.shop) {
        setShop(null)
        setProducts([])
        return
      }
      const mapped = mapShopPublicToShop(shopRes.shop)
      setShop(mapped)
      const [productsRes, reviewsRes] = await Promise.all([
        shopService.getShopProducts(mapped.id, {
          pageSize: 40,
          sortBy: 'newest',
        }),
        reviewService.getShopReviews(mapped.id, { pageSize: 8, sortBy: 'newest' }).catch(() => null),
      ])
      setProducts(productsRes.products || [])
      setShopReviews(reviewsRes?.success ? reviewsRes.reviews || [] : [])
    } catch (error: any) {
      console.error('Failed to load shop:', error)
      setShop(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  if (!shop) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy cửa hàng</Text>
      </View>
    )
  }

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
      
      <ScrollView showsVerticalScrollIndicator={false}>
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
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.onPrimary} />
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
                    <ActivityIndicator size="small" color={COLORS.primary} />
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
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.statText}>{shop.averageRating.toFixed(1)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.statText}>{shop.productCount} SP</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                  <Ionicons name="people-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.statText}>{shop.followerCount}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {shop.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giới thiệu</Text>
            <Text style={styles.description}>{shop.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Đánh giá từ khách ({shop.reviewCount})
          </Text>
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
                {r.content ? (
                  <Text style={styles.reviewContent}>{r.content}</Text>
                ) : null}
                <Text style={styles.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sản phẩm ({products.length})</Text>
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
    marginBottom: SIZES.sm,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  statText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.border,
    marginHorizontal: SIZES.sm,
  },
  section: {
    padding: SIZES.lg,
    marginTop: SIZES.xxl,
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
