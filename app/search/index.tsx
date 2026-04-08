import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const { width } = Dimensions.get('window')

export default function SearchScreen() {
  const router = useRouter()
  const searchInputRef = useRef<TextInput>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [featuredLoading, setFeaturedLoading] = useState(true)

  const isSearching = searchQuery.trim().length > 0

  /** Load sản phẩm nổi bật (best_seller) khi màn hình mở lần đầu */
  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true)
    try {
      const response = await productService.getProducts({
        sortBy: 'best_seller',
        pageSize: 20,
      })
      setFeaturedProducts(response.products || [])
    } catch {
      // ignore
    } finally {
      setFeaturedLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFeatured()
  }, [loadFeatured])

  useEffect(() => {
    if (!isSearching) {
      setProducts([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await productService.getProducts({
          search: searchQuery.trim(),
          pageSize: 20,
        })
        setProducts(response.products || [])
      } catch (error: any) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, isSearching])

  const displayProducts = isSearching ? products : featuredProducts
  const isLoading = isSearching ? loading : featuredLoading

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Tìm kiếm sản phẩm..."
            placeholderTextColor={COLORS.placeholder}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              searchInputRef.current?.clear()
              setSearchQuery('')
            }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={displayProducts}
          renderItem={({ item }) => (
            <View style={styles.productItem}>
              <ProductCard
                product={item}
                onPress={() => router.push(`/products/${item.slug}`)}
              />
            </View>
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={
            !isSearching && displayProducts.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Sản phẩm bán chạy</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isSearching ? (
                <>
                  <Ionicons name="file-tray-outline" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
                  <Text style={styles.emptySubtext}>Thử tìm kiếm với từ khóa khác</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Chưa có sản phẩm nào</Text>
                </>
              )}
            </View>
          }
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    gap: SIZES.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SIZES.xs,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 12,
    gap: SIZES.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.size.md,
    color: COLORS.text,
    paddingVertical: SIZES.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContent: {
    padding: SIZES.lg,
  },
  columnWrapper: {
    gap: SIZES.md,
  },
  productItem: {
    flex: 1,
    maxWidth: (width - SIZES.lg * 2 - SIZES.md) / 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
