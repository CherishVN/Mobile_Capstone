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

const { width } = Dimensions.get('window')

export default function ShopDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const slug = params.slug as string
  const { isAuthenticated } = useAuthStore()

  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [openingChat, setOpeningChat] = useState(false)

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
      const productsRes = await shopService.getShopProducts(mapped.id, {
        pageSize: 40,
        sortBy: 'newest',
      })
      setProducts(productsRes.products || [])
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
              <TouchableOpacity
                style={styles.chatShopBtn}
                onPress={openShopChat}
                disabled={openingChat}
                activeOpacity={0.8}
              >
                {openingChat ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.onPrimary} />
                    <Text style={styles.chatShopBtnText}>Chat với shop</Text>
                  </>
                )}
              </TouchableOpacity>
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
  chatShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: SIZES.md,
    borderRadius: 10,
    marginBottom: SIZES.sm,
    minHeight: 36,
  },
  chatShopBtnText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.sm,
    fontWeight: '600',
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
