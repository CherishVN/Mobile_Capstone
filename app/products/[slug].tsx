import React, { useEffect, useState, useMemo } from 'react'
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
  ActivityIndicator,
  Modal,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { cartService } from '@/services/cart-service'
import { favoriteService } from '@/services/favorite-service'
import { reviewService } from '@/services/review-service'
import { shopService } from '@/services/shop-service'
import { ProductDetail, ProductVariant, Product } from '@/types/product'
import { ProductReview } from '@/types/review'
import { ShopPublicDto } from '@/types/shop'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width } = Dimensions.get('window')
const CHECKOUT_SELECTED_IDS_KEY = 'checkout:selected-item-ids'

/* Shopee-specific Colors */
const SHOPEE_RED = '#f05d40'
const SHOPEE_PRICE = '#ee4d2d'
const SHOPEE_TEAL_DARK = '#119c8f'
const SHOPEE_TEAL_LIGHT = '#14b0a1'

export default function ProductDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const slug = params.slug as string
  
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [shop, setShop] = useState<ShopPublicDto | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)
  
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [reviews, setReviews] = useState<ProductReview[]>([])
  
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [modalAction, setModalAction] = useState<'cart' | 'buy'>('cart')
  
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const cartItemCount = useCartStore((s) => s.cart?.items?.length || 0)
  const updateCartStore = useCartStore((s) => s.setCart)

  useEffect(() => {
    loadData()
  }, [slug])

  const loadData = async () => {
    try {
      // 1. Lấy Product
      const prodRes = await productService.getProductBySlug(slug)
      let p: ProductDetail | null = null
      if (prodRes.success && prodRes.product) {
        setProduct(prodRes.product)
        p = prodRes.product
        if (p.variants.length > 0) {
          setSelectedVariant(p.variants[0])
        }
      }

      // Nếu có product -> Lấy Shop, related, review
      if (p) {
        // Reviews
        reviewService
          .getProductReviews(p.id, { pageSize: 5, sortBy: 'newest' })
          .then((r) => r.success && setReviews(r.reviews || []))
          .catch(() => {})

        // Favorite
        if (isAuthenticated) {
          favoriteService.check(p.id)
            .then(r => r.success && setFavorited(r.isFavorited))
            .catch(() => {})
        }

        // Shop Details & Related Products
        try {
          const shopRes = await shopService.getShopBySlug(p.shopSlug)
          if (shopRes.success && shopRes.shop) {
            setShop(shopRes.shop)
            const relRes = await shopService.getShopProducts(shopRes.shop.id, { pageSize: 8 })
            if (relRes.success && relRes.products) {
              setRelatedProducts(relRes.products.filter(rp => rp.id !== p?.id))
            }
          }
        } catch (e) {
          console.warn('Cannot load shop details', e)
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

  const addToCartAction = async () => {
    if (!product) return null
    if (!isAuthenticated) {
      Alert.alert('Đăng nhập', 'Vui lòng đăng nhập để thêm vào giỏ hàng.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/auth/login') },
      ])
      return null
    }

    try {
      const res = await cartService.addItem({
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      })
      if (!res.success) throw new Error(res.message || 'Lỗi thêm vào giỏ')
      
      // Update global cart store so the badge updates immediately
      try {
        const cartRes = await cartService.getMyCart()
        if (cartRes.success && cartRes.data) {
          updateCartStore(cartRes.data)
        }
      } catch (e) {
        console.warn('Cannot update cart store', e)
      }
      
      return res.data // Trả về cart Item
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể thêm vào giỏ hàng')
      return null
    }
  }

  const handleAddToCart = async () => {
    setAddingToCart(true)
    const res = await addToCartAction()
    setAddingToCart(false)
    if (res) {
      Alert.alert('Thành công', 'Đã thêm sản phẩm vào giỏ hàng')
    }
  }

  const handleBuyNow = async () => {
    setBuyingNow(true)
    const addedItem = await addToCartAction()
    setBuyingNow(false)
    
    if (addedItem) {
      try {
        await AsyncStorage.setItem(CHECKOUT_SELECTED_IDS_KEY, JSON.stringify([addedItem.id]))
        router.push('/checkout')
      } catch (e) {
        Alert.alert('Lỗi', 'Không thể chuyển tới trang thanh toán')
      }
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ'
  }

  if (loading) return <Loading />
  
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* === 1. TOP CAROUSEL & BADGES === */}
        <View style={styles.imageSection}>
          <FlatList
            data={product.imageUrls.length > 0 ? product.imageUrls : ['https://via.placeholder.com/400?text=No+Image']}
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
          
          {/* Overlays */}
          <View style={styles.topBarOverlay}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
               <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topRightBtns}>
              <TouchableOpacity style={styles.circleBtn}>
                 <Ionicons name="share-social-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/cart')}>
                 <Ionicons name="cart-outline" size={24} color="#fff" />
                 {cartItemCount > 0 && (
                   <View style={styles.cartBadge}>
                     <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
                   </View>
                 )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Slide Indicator */}
          <View style={styles.imageIndicator}>
             <Text style={styles.imageIndicatorText}>
               {activeImageIndex + 1}/{Math.max(product.imageUrls.length, 1)}
             </Text>
          </View>
        </View>

        {/* === 2. INFO & PRICE === */}
        <View style={styles.infoSection}>
          <View style={styles.priceRow}>
            <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
               <Text style={styles.mainPrice}>{formatPrice(currentPrice)}</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
               <Text style={styles.soldCount}>Đã bán {product.soldCount}</Text>
               <TouchableOpacity onPress={handleToggleFavorite} disabled={favBusy}>
                 <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={24} color={favorited ? SHOPEE_PRICE : COLORS.textSecondary} />
               </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.productTitle}>{product.name}</Text>
        </View>

        {/* === 3. SELECT VARIANT INLINE === */}
        {product.variants.length > 0 && (
          <TouchableOpacity 
             style={styles.inlineVariantRow}
             onPress={() => {
               setModalAction('cart')
               setShowVariantModal(true)
             }}
             activeOpacity={0.7}
          >
             <Text style={styles.inlineVariantLabel}>Chọn loại hàng</Text>
             <View style={styles.inlineVariantRight}>
                <Text style={styles.inlineVariantValue}>
                  {selectedVariant ? selectedVariant.variantName : 'Chọn biến thể'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
             </View>
          </TouchableOpacity>
        )}

        {/* === 4. REVIEWS === */}
        <View style={styles.cardSection}>
           <View style={styles.reviewHeader}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={styles.reviewScore}>{product.averageRating.toFixed(1)}</Text>
               <Ionicons name="star" size={14} color="#ffc107" style={{marginHorizontal: 4}} />
               <Text style={styles.reviewTitle}>Đánh giá Shop ({product.reviewCount})</Text>
             </View>
             <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.seeAllText}>Tất cả</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
             </TouchableOpacity>
           </View>
           
           {reviews.slice(0, 2).map((r, idx) => (
             <View key={r.id} style={[styles.reviewItem, idx > 0 && {borderTopWidth: 1, borderTopColor: '#f0f0f0'}]}>
                <View style={styles.reviewUserRow}>
                  <Ionicons name="person-circle" size={24} color="#ccc" />
                  <Text style={styles.reviewUserName}>
                    {r.userName ? r.userName.charAt(0) + '****' + r.userName.slice(-1) : 'k*****h'}
                  </Text>
                </View>
                <View style={styles.reviewStars}>
                   {[1,2,3,4,5].map(s => (
                     <Ionicons key={s} name="star" size={12} color={s <= r.rating ? "#ffc107" : "#eee"} />
                   ))}
                </View>
                <Text style={styles.reviewComment}>{r.comment || ''}</Text>
             </View>
           ))}
        </View>

        {/* === 5. SHOP INFO === */}
        <View style={styles.cardSection}>
          <View style={styles.shopRow}>
             <Image source={{ uri: shop?.logoUrl || 'https://via.placeholder.com/80' }} style={styles.shopAvatar} />
             <View style={styles.shopInfoCenter}>
               <Text style={styles.shopNameText}>{shop?.name || product.shopName}</Text>
             </View>
             <TouchableOpacity style={styles.viewShopBtn} onPress={() => router.push(`/shop/${product.shopSlug}`)}>
               <Text style={styles.viewShopText}>Xem Shop</Text>
             </TouchableOpacity>
          </View>
          <View style={styles.shopStatsRow}>
             <View style={styles.shopStatCol}>
                <Text style={styles.shopStatNum}>{shop?.averageRating?.toFixed(1) || '4.7'}</Text>
                <Text style={styles.shopStatLabel}>Đánh giá</Text>
             </View>
             <View style={styles.shopStatColCenter}>
                <Text style={styles.shopStatNum}>{shop?.productCount || 0}</Text>
                <Text style={styles.shopStatLabel}>Sản phẩm</Text>
             </View>
             {shop?.createdAt && (
               <View style={styles.shopStatCol}>
                  <Text style={styles.shopStatNum}>
                    {new Date(shop.createdAt).toLocaleDateString('vi-VN', { year: 'numeric' })}
                  </Text>
                  <Text style={styles.shopStatLabel}>Tham gia</Text>
               </View>
             )}
          </View>
        </View>

        {/* === 6. TOP RELATED === */}
        {relatedProducts.length > 0 && (
          <View style={styles.cardSection}>
             <View style={styles.relatedHeader}>
                <Text style={styles.relatedTitle}>Top sản phẩm nổi bật</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
             </View>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {relatedProducts.map(rp => (
                  <TouchableOpacity key={rp.id} style={styles.relatedCard} onPress={() => router.push(`/products/${rp.slug}`)}>
                     <Image source={{ uri: rp.imageUrls[0] || 'https://via.placeholder.com/150' }} style={styles.relatedImg} />
                     <Text style={styles.relatedName} numberOfLines={2}>{rp.name}</Text>
                     <Text style={styles.relatedPrice}>{formatPrice(rp.basePrice)}</Text>
                     <View style={styles.relatedFooter}>
                        <Text style={styles.relatedSold}>Đã bán {rp.soldCount}</Text>
                     </View>
                  </TouchableOpacity>
                ))}
             </ScrollView>
          </View>
        )}

        {/* === 7. DESCRIPTION === */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitleShopee}>Chi tiết sản phẩm</Text>
          <Text style={styles.descriptionText}>{product.description || 'Sản phẩm chưa có mô tả chi tiết.'}</Text>
        </View>
        
        {/* Padding for sticky footer */}
        <View style={{height: 100}} />
      </ScrollView>

      {/* === MODERN STICKY FOOTER === */}
      <View style={styles.modernFooter}>
         <TouchableOpacity 
           style={styles.modernChatBtn} 
           onPress={() => router.push('/messages' as any)}
         >
            <Ionicons name="chatbubbles-outline" size={22} color={COLORS.primary} />
            <Text style={styles.modernChatText}>Chat</Text>
         </TouchableOpacity>
         
         <View style={styles.modernActionRow}>
           <TouchableOpacity 
            style={styles.modernOutlineBtn}
            onPress={() => {
              setModalAction('cart')
              setShowVariantModal(true)
            }}
            disabled={addingToCart || currentStock === 0}
           >
              {addingToCart ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                <Text style={styles.modernOutlineBtnText}>Thêm vào giỏ</Text>
              )}
           </TouchableOpacity>

           <TouchableOpacity 
            style={styles.modernSolidBtn}
            onPress={() => {
              setModalAction('buy')
              setShowVariantModal(true)
            }}
            disabled={buyingNow || currentStock === 0}
           >
              {buyingNow ? <ActivityIndicator color={COLORS.onPrimary} size="small" /> : (
                <View style={styles.modernSolidBtnContent}>
                  <Text style={styles.modernSolidBtnTitle}>Mua ngay</Text>
                  <Text style={styles.modernSolidBtnPrice}>{formatPrice(currentPrice)}</Text>
                </View>
              )}
           </TouchableOpacity>
         </View>
      </View>

      {/* === VARIANT MODAL === */}
      <Modal visible={showVariantModal} transparent animationType="slide" onRequestClose={() => setShowVariantModal(false)}>
         <View style={styles.modalBackdrop}>
           <TouchableOpacity style={{flex: 1}} onPress={() => setShowVariantModal(false)} />
           <View style={styles.modalContent}>
             <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVariantModal(false)}>
               <Ionicons name="close" size={24} color={COLORS.textSecondary} />
             </TouchableOpacity>
             
             {/* Header */}
             <View style={styles.modalHeader}>
               <Image source={{uri: product.imageUrls[0] || 'https://via.placeholder.com/80'}} style={styles.modalImg} />
               <View style={styles.modalHeaderInfo}>
                 <Text style={styles.modalPrice}>{formatPrice(currentPrice)}</Text>
                 <Text style={styles.modalStock}>Kho: {currentStock}</Text>
                 {selectedVariant && (
                   <Text style={styles.modalSelectedText}>Đã chọn: {selectedVariant.variantName}</Text>
                 )}
               </View>
             </View>

             <ScrollView showsVerticalScrollIndicator={false}>
                {/* Variants List */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Phân loại</Text>
                  <View style={styles.variantsContainer}>
                    {product.variants.length > 0 ? (
                      product.variants.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={[
                            styles.shopeeVariantBtn,
                            selectedVariant?.id === v.id && styles.shopeeVariantBtnActive,
                            !v.isActive && { opacity: 0.5 }
                          ]}
                          onPress={() => v.isActive && setSelectedVariant(v)}
                          disabled={!v.isActive}
                        >
                          <Text style={[
                            styles.shopeeVariantText,
                            selectedVariant?.id === v.id && styles.shopeeVariantTextActive
                          ]}>
                            {v.variantName}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={{color: COLORS.textSecondary, fontSize: 13}}>Sản phẩm mặc định</Text>
                    )}
                  </View>
                </View>
                
                {/* Quantity */}
                <View style={styles.modalSectionRow}>
                  <Text style={styles.modalSectionTitle}>Số lượng</Text>
                  <View style={styles.qtyControls}>
                     <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                        <Ionicons name="remove" size={16} color={COLORS.text}/>
                     </TouchableOpacity>
                     <Text style={styles.qtyValue}>{quantity}</Text>
                     <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.min(currentStock, quantity + 1))}>
                        <Ionicons name="add" size={16} color={COLORS.text}/>
                     </TouchableOpacity>
                  </View>
                </View>
             </ScrollView>

             {/* Modal Action Footer */}
             <View style={styles.modalFooter}>
               <TouchableOpacity 
                 style={[styles.modalConfirmBtn, currentStock === 0 && {opacity: 0.5}]}
                 disabled={currentStock === 0}
                 onPress={() => {
                   setShowVariantModal(false)
                   if (modalAction === 'cart') handleAddToCart()
                   else handleBuyNow()
                 }}
               >
                  <Text style={styles.modalConfirmText}>
                     {modalAction === 'cart' ? 'Thêm vào Giỏ hàng' : 'Mua ngay'}
                  </Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
      </Modal>

    </View>
  )
}

/* === STYLES === */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ebebeb',
  },
  content: {
    flex: 1,
  },
  /* HERO IMAGE */
  imageSection: {
    position: 'relative',
    height: width,
    backgroundColor: '#fff',
  },
  productImage: {
    width: width,
    height: width,
  },
  topBarOverlay: {
    position: 'absolute',
    top: SIZES.xxl,
    left: SIZES.md,
    right: SIZES.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topRightBtns: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: SHOPEE_RED,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  hotSaleBadge: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  hotSaleText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#8b5a2b',
    fontStyle: 'italic',
  },
  readyStockBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: SHOPEE_TEAL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 2,
    borderTopLeftRadius: 12,
  },
  readyStockText: {
    color: '#fff',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  imageIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  /* INFO & PRICE */
  infoSection: {
    backgroundColor: '#fff',
    padding: SIZES.md,
    marginBottom: SIZES.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: SHOPEE_PRICE,
  },
  priceTag: {
    borderWidth: 1,
    borderColor: SHOPEE_PRICE,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  priceTagText: {
    fontSize: 10,
    color: SHOPEE_PRICE,
  },
  soldCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  promoTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  promoTagBorder: {
    borderWidth: 1,
    borderColor: 'rgba(238,77,45,0.3)',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  promoTagBorderText: {
    fontSize: 10,
    color: SHOPEE_PRICE,
  },
  productTitle: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 22,
  },
  /* REUSABLE CARD */
  cardSection: {
    backgroundColor: '#fff',
    padding: SIZES.md,
    marginBottom: SIZES.xs,
  },
  sectionTitleShopee: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
    fontWeight: '500',
  },
  /* INLINE VARIANTS */
  inlineVariantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: SIZES.md,
    marginBottom: SIZES.xs,
  },
  inlineVariantLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  inlineVariantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineVariantValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: SIZES.lg,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: SIZES.md,
    alignItems: 'flex-end',
  },
  modalImg: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  modalHeaderInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: SHOPEE_PRICE,
  },
  modalStock: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  modalSelectedText: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
    fontWeight: '500',
  },
  modalSection: {
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalSectionRow: {
    padding: SIZES.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalSectionTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: SIZES.sm,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  qtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  qtyValue: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ddd',
  },
  modalFooter: {
    padding: SIZES.md,
    paddingTop: SIZES.md,
  },
  modalConfirmBtn: {
    backgroundColor: SHOPEE_RED,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  /* VARIANTS SHARED */
  variantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  shopeeVariantBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f5f5f5',
  },
  shopeeVariantBtnActive: {
    backgroundColor: '#fff',
    borderColor: SHOPEE_PRICE,
  },
  shopeeVariantText: {
    fontSize: 13,
    color: '#333',
  },
  shopeeVariantTextActive: {
    color: SHOPEE_PRICE,
  },
  dividerPlain: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginVertical: 12,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliveryText: {
    fontSize: 13,
    color: COLORS.text,
  },
  deliverySub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
    paddingLeft: 6,
  },
  /* REVIEWS */
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewScore: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  reviewTitle: {
    fontSize: 14,
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  reviewItem: {
    paddingVertical: 12,
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reviewUserName: {
    fontSize: 12,
    color: COLORS.text,
  },
  helpfulText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  reviewStars: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  /* SHOP INFO */
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#eee',
  },
  shopInfoCenter: {
    flex: 1,
    marginLeft: 12,
  },
  shopNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  shopOnlineText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  shopLocationText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  viewShopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: SHOPEE_PRICE,
    borderRadius: 4,
  },
  viewShopText: {
    fontSize: 12,
    color: SHOPEE_PRICE,
  },
  shopStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  shopStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  shopStatColCenter: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#eee',
  },
  shopStatNum: {
    fontSize: 14,
    fontWeight: '600',
    color: SHOPEE_PRICE,
  },
  shopStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  /* RELATED PRODUCTS */
  relatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  relatedTitle: {
    fontSize: 14,
    color: COLORS.text,
  },
  relatedCard: {
    width: 120,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 4,
    position: 'relative',
    backgroundColor: '#fff',
  },
  relatedImg: {
    width: 118,
    height: 118,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  relatedBadge: {
    position: 'absolute',
    top: 90,
    left: 0,
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  relatedBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#8b5a2b',
  },
  readyStockBadgeRel: {
    position: 'absolute',
    top: 104,
    right: 0,
    backgroundColor: SHOPEE_TEAL_DARK,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  readyStockTextRel: {
     fontSize: 8,
     color: '#fff',
     fontWeight: 'bold'
  },
  relatedName: {
    fontSize: 12,
    color: COLORS.text,
    margin: 6,
    height: 32,
  },
  relatedPrice: {
    fontSize: 14,
    color: SHOPEE_PRICE,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  relatedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 6,
  },
  relatedRating: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginLeft: -8,
  },
  relatedSold: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  /* DESCRIPTION */
  descriptionText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  /* MODERN STICKY FOOTER */
  modernFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    paddingBottom: SIZES.lg, // Safe area for phones
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modernChatBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZES.md,
    width: 44,
  },
  modernChatText: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  modernActionRow: {
    flex: 1,
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  modernOutlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  modernOutlineBtnText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modernSolidBtn: {
    flex: 1.2,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modernSolidBtnContent: {
    alignItems: 'center',
  },
  modernSolidBtnTitle: {
    fontSize: 12,
    color: COLORS.onPrimary,
    fontWeight: '600',
  },
  modernSolidBtnPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.onPrimary,
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
