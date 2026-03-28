import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const { width } = Dimensions.get('window')

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'best_seller'

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Bán chạy', value: 'best_seller' },
  { label: 'Giá thấp', value: 'price_asc' },
  { label: 'Giá cao', value: 'price_desc' },
  { label: 'Đánh giá', value: 'rating' },
]

export default function ProductsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showSortOptions, setShowSortOptions] = useState(false)

  const categoryId = params.categoryId ? Number(params.categoryId) : undefined
  const searchQuery = params.search ? String(params.search) : undefined

  const loadProducts = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (isRefresh) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const response = await productService.getProducts({
          page: pageNum,
          pageSize: 20,
          categoryId,
          search: searchQuery,
          sortBy,
        })

        if (isRefresh) {
          setProducts(response.products)
        } else {
          setProducts((prev) => [...prev, ...response.products])
        }

        setHasMore(response.products.length === 20)
      } catch (error: any) {
        console.error('Failed to load products:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [categoryId, searchQuery, sortBy]
  )

  useEffect(() => {
    setPage(1)
    loadProducts(1, true)
  }, [categoryId, searchQuery, sortBy])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      loadProducts(nextPage, false)
    }
  }

  const handleSortChange = (option: SortOption) => {
    setSortBy(option)
    setShowSortOptions(false)
  }

  if (loading) {
    return <Loading />
  }

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label || 'Sắp xếp'

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sản phẩm</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowSortOptions(!showSortOptions)}
          activeOpacity={0.7}
        >
          <Text style={styles.filterButtonText}>{currentSortLabel}</Text>
          <Ionicons
            name={showSortOptions ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {showSortOptions && (
        <View style={styles.sortOptionsContainer}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive,
              ]}
              onPress={() => handleSortChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === option.value && styles.sortOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {sortBy === option.value && (
                <Ionicons name="checkmark" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={products}
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
          </View>
        }
      />
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
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SIZES.xs,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  filterBar: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    backgroundColor: COLORS.background,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    gap: SIZES.sm,
  },
  filterButtonText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  sortOptionsContainer: {
    backgroundColor: COLORS.card,
    marginHorizontal: SIZES.lg,
    borderRadius: 8,
    marginBottom: SIZES.md,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortOptionActive: {
    backgroundColor: COLORS.background,
  },
  sortOptionText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  sortOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
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
  loadingMore: {
    paddingVertical: SIZES.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
  },
})
