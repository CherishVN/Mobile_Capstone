import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  FlatList,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { cartService } from '@/services/cart-service'
import { favoriteService } from '@/services/favorite-service'
import { reviewService } from '@/services/review-service'
import { ProductDetail, ProductVariant } from '@/types/product'
import { ProductReview } from '@/types/review'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'

const { width } = Dimensions.get('window')

export default function ProductDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const slug = params.slug as string
  
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    loadProduct()
  }, [slug])

  useEffect(() => {
    if (!product) return
    reviewService
      .getProductReviews(product.id, { pageSize: 8, sortBy: 'newest' })
      .then((r) => {
        if (r.success) setReviews(r.reviews || [])
      })
      .catch(() => setReviews([]))
  }, [product?.id])

  useEffect(() => {
    if (!product || !isAuthenticated) {
      setFavorited(false)
      return
    }
    favoriteService
      .check(product.id)
      .then((r) => {
        if (r.success) setFavorited(r.isFavorited)
      })
      .catch(() => setFavorited(false))
  }, [product?.id, isAuthenticated])

  const loadProduct = async () => {
    try {
      const response = await productService.getProductBySlug(slug)
      if (response.success && response.product) {
        setProduct(response.product)
        if (response.product.variants.length > 0) {
          setSelectedVariant(response.product.variants[0])
        }
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải thông tin sản phẩm')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!product) return
    if (!isAuthenticated) {
      Alert.alert('Đăng nhập', 'Đăng nhập để lưu sản phẩm yêu thích.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/auth/login') },
      ])
      return
    }
    setFavBusy(true)
    try {
      const r = await favoriteService.toggle(product.id)
      if (r.success) setFavorited(r.isFavorited)
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thực hiện được')
    } finally {
      setFavBusy(false)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return
    if (!isAuthenticated) {
      Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thêm vào giỏ hàng.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/auth/login') },
      ])
      return
    }

    setAddingToCart(true)
    try {
      await cartService.addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      })
      Alert.alert('Thành công', 'Đã thêm sản phẩm vào giỏ hàng')
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể thêm vào giỏ hàng')
    } finally {
      setAddingToCart(false)
    }
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

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy sản phẩm</Text>
      </View>
    )
  }

  const currentPrice = selectedVariant?.price || product.basePrice
  const currentStock = selectedVariant?.stockQuantity || product.totalStock

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.imageSection}>
        <FlatList
          data={product.imageUrls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width)
            setActiveImageIndex(index)
          }}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.productImage} resizeMode="cover" />
          )}
          keyExtractor={(item, index) => index.toString()}
        />
        
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.background} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.favButton}
          onPress={handleToggleFavorite}
          disabled={favBusy}
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={24}
            color={favorited ? '#FF3B30' : COLORS.background}
          />
        </TouchableOpacity>

        {product.imageUrls.length > 1 && (
          <View style={styles.pagination}>
            {product.imageUrls.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeImageIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mainInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          
          <TouchableOpacity
            style={styles.shopInfo}
            onPress={() => router.push(`/shop/${product.shopSlug}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="storefront-outline" size={16} color={COLORS.primary} />
            <Text style={styles.shopName}>{product.shopName}</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.statText}>
                {product.averageRating.toFixed(1)} ({product.reviewCount})
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Ionicons name="bag-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.statText}>Đã bán {product.soldCount}</Text>
            </View>
          </View>

          <Text style={styles.price}>{formatPrice(currentPrice)}</Text>
        </View>

        {product.variants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phân loại</Text>
            <View style={styles.variantsContainer}>
              {product.variants.map((variant) => (
                <TouchableOpacity
                  key={variant.id}
                  style={[
                    styles.variantChip,
                    selectedVariant?.id === variant.id && styles.variantChipActive,
                    !variant.isActive && styles.variantChipDisabled,
                  ]}
                  onPress={() => variant.isActive && setSelectedVariant(variant)}
                  disabled={!variant.isActive}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.variantText,
                      selectedVariant?.id === variant.id && styles.variantTextActive,
                      !variant.isActive && styles.variantTextDisabled,
                    ]}
                  >
                    {variant.variantName}
                  </Text>
                  {!variant.isActive && (
                    <Text style={styles.outOfStockText}>Hết hàng</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Số lượng</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Ionicons name="remove" size={20} color={quantity <= 1 ? COLORS.placeholder : COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.min(currentStock, quantity + 1))}
              disabled={quantity >= currentStock}
            >
              <Ionicons
                name="add"
                size={20}
                color={quantity >= currentStock ? COLORS.placeholder : COLORS.text}
              />
            </TouchableOpacity>
            <Text style={styles.stockText}>Còn {currentStock} sản phẩm</Text>
          </View>
        </View>

        {product.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đánh giá ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.reviewEmpty}>Chưa có đánh giá hiển thị</Text>
          ) : (
            reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewRow}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewUser}>{rev.userName || 'Khách'}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= rev.rating ? 'star' : 'star-outline'}
                        size={14}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                </View>
                {rev.comment ? (
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                ) : null}
                <Text style={styles.reviewDate}>
                  {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Thêm vào giỏ hàng"
          onPress={handleAddToCart}
          loading={addingToCart}
          disabled={currentStock === 0}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageSection: {
    position: 'relative',
    height: width,
    backgroundColor: COLORS.card,
  },
  productImage: {
    width,
    height: width,
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
  favButton: {
    position: 'absolute',
    top: SIZES.xxl + 10,
    right: SIZES.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    position: 'absolute',
    bottom: SIZES.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SIZES.xs,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: COLORS.background,
    width: 24,
  },
  content: {
    flex: 1,
  },
  mainInfo: {
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productName: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.md,
  },
  shopName: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  statText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.border,
    marginHorizontal: SIZES.md,
  },
  price: {
    fontSize: FONTS.size.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  section: {
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  variantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  variantChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  variantChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  variantChipDisabled: {
    opacity: 0.5,
  },
  variantText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  variantTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  variantTextDisabled: {
    color: COLORS.textSecondary,
  },
  outOfStockText: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    marginTop: SIZES.xs,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 40,
    textAlign: 'center',
  },
  stockText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  footer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  reviewEmpty: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  reviewRow: {
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: {
    marginTop: SIZES.xs,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  reviewDate: {
    marginTop: SIZES.xs,
    fontSize: FONTS.size.xs,
    color: COLORS.placeholder,
  },
})
