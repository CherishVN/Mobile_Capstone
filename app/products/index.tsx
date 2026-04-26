import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import {
  type StorefrontSort,
  parseSortParam,
  SORT_LABELS,
  DEFAULT_PAGE_SIZE,
} from '@/constants/storefront-filters'

const { width } = Dimensions.get('window')

function readNumParam(v: string | string[] | undefined | null): number | undefined {
  if (v == null) return undefined
  const s = (Array.isArray(v) ? v[0] : v).toString().trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export default function ProductsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const categoryId = params.categoryId ? Number(params.categoryId) : undefined
  const searchQuery = params.search ? String(params.search) : undefined

  const [sortBy, setSortBy] = useState<StorefrontSort>(() => {
    const p = parseSortParam(params.sortBy)
    const hasSearch = !!(params.search && String(params.search).trim())
    if (p === 'relevance' && !hasSearch) return 'newest'
    if (p) return p
    return 'newest'
  })
  const [showSortOptions, setShowSortOptions] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [appliedMinPrice, setAppliedMinPrice] = useState<number | undefined>(() =>
    readNumParam(params.minPrice)
  )
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | undefined>(() =>
    readNumParam(params.maxPrice)
  )
  const [appliedMinRating, setAppliedMinRating] = useState<number | undefined>(() =>
    readNumParam(params.minRating)
  )
  const [inMin, setInMin] = useState(
    readNumParam(params.minPrice) != null ? String(readNumParam(params.minPrice)) : ''
  )
  const [inMax, setInMax] = useState(
    readNumParam(params.maxPrice) != null ? String(readNumParam(params.maxPrice)) : ''
  )
  const [inRating, setInRating] = useState(
    readNumParam(params.minRating) != null ? String(readNumParam(params.minRating)) : ''
  )

  const sortOptions = useMemo((): StorefrontSort[] => {
    if (searchQuery?.trim()) {
      return ['relevance', 'newest', 'best_seller', 'price_asc', 'price_desc', 'rating']
    }
    return ['newest', 'best_seller', 'price_asc', 'price_desc', 'rating']
  }, [searchQuery])

  useEffect(() => {
    const p = parseSortParam(params.sortBy)
    if (p) {
      if (p === 'relevance' && !searchQuery?.trim()) {
        setSortBy('newest')
      } else {
        setSortBy(p)
      }
    }
  }, [params.sortBy, searchQuery])

  useEffect(() => {
    if (sortBy === 'relevance' && !searchQuery?.trim()) {
      setSortBy('newest')
    }
  }, [searchQuery, sortBy])

  const loadProducts = useCallback(
    async (pageNum: number, isRefresh = false) => {
      if (isRefresh) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const effectiveSort: StorefrontSort =
        sortBy === 'relevance' && !searchQuery?.trim() ? 'newest' : sortBy

      try {
        const response = await productService.getProducts({
          page: pageNum,
          pageSize: DEFAULT_PAGE_SIZE,
          categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
          search: searchQuery?.trim() || undefined,
          sortBy: effectiveSort,
          minPrice: appliedMinPrice,
          maxPrice: appliedMaxPrice,
          minRating: appliedMinRating,
        })

        if (isRefresh) {
          setProducts(response.products)
        } else {
          setProducts((prev) => [...prev, ...response.products])
        }

        setHasMore(response.products.length === DEFAULT_PAGE_SIZE)
      } catch (error: any) {
        console.error('Failed to load products:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [categoryId, searchQuery, sortBy, appliedMinPrice, appliedMaxPrice, appliedMinRating]
  )

  useEffect(() => {
    setPage(1)
    void loadProducts(1, true)
  }, [categoryId, searchQuery, sortBy, appliedMinPrice, appliedMaxPrice, appliedMinRating, loadProducts])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      void loadProducts(nextPage, false)
    }
  }

  const applyFilters = () => {
    const parse = (s: string) => {
      const t = s.replace(/\D/g, '')
      if (!t) return undefined
      const n = Number(t)
      return Number.isFinite(n) && n >= 0 ? n : undefined
    }
    const r = inRating.replace(/[^\d.]/g, '')
    const ratingNum =
      r === '' ? undefined : Math.min(5, Math.max(0, parseFloat(r) || 0)) || undefined
    setAppliedMinPrice(parse(inMin))
    setAppliedMaxPrice(parse(inMax))
    setAppliedMinRating(ratingNum)
  }

  const currentSortLabel = SORT_LABELS[sortBy] || 'Sắp xếp'

  if (loading) {
    return <Loading />
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {searchQuery ? `Tìm “${searchQuery}”` : 'Sản phẩm'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filterRow}>
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
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            setShowFilters(!showFilters)
            setShowSortOptions(false)
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="funnel-outline" size={18} color={COLORS.text} />
          <Text style={styles.filterButtonText}>Lọc</Text>
        </TouchableOpacity>
      </View>

      {showSortOptions && (
        <View style={styles.sortOptionsContainer}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(option)
                setShowSortOptions(false)
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.sortOptionText, sortBy === option && styles.sortOptionTextActive]}
              >
                {SORT_LABELS[option]}
              </Text>
              {sortBy === option && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterInputsRow}>
            <TextInput
              style={styles.filterInput}
              placeholder="Giá từ"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
              value={inMin}
              onChangeText={setInMin}
            />
            <Text style={styles.filterDash}>-</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="đến"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
              value={inMax}
              onChangeText={setInMax}
            />
            <TextInput
              style={[styles.filterInput, { flex: 0.8 }]}
              placeholder="Sao ≥"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="decimal-pad"
              value={inRating}
              onChangeText={setInRating}
            />
          </View>
          <TouchableOpacity style={styles.applyFilterBtn} onPress={applyFilters} activeOpacity={0.8}>
            <Text style={styles.applyFilterText}>Áp dụng lọc</Text>
          </TouchableOpacity>
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
    flex: 1,
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    gap: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    gap: SIZES.xs,
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
  filterPanel: {
    marginHorizontal: SIZES.lg,
    marginBottom: SIZES.md,
    padding: SIZES.md,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  filterInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 8,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
  },
  filterDash: {
    color: COLORS.textSecondary,
  },
  applyFilterBtn: {
    marginTop: SIZES.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyFilterText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
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
