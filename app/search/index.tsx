import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import type { TextInput as TextInputType } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { productService } from '@/services/product-service'
import { categoryService } from '@/services/category-service'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
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

export default function SearchScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const searchInputRef = useRef<TextInputType>(null)

  const categoryId = params.categoryId ? Number(params.categoryId) : undefined
  const paramQ = useMemo(() => {
    const q = params.q
    if (q == null) return ''
    return (Array.isArray(q) ? q[0] : String(q)) || ''
  }, [params.q])

  const [searchQuery, setSearchQuery] = useState(paramQ)
  const [debouncedQuery, setDebouncedQuery] = useState(paramQ.trim())

  const [categoryName, setCategoryName] = useState<string | null>(null)

  const [sortBy, setSortBy] = useState<StorefrontSort>(() => {
    const p = parseSortParam(params.sortBy)
    if (p === 'relevance' && !paramQ.trim()) return 'newest'
    if (p) return p
    if (paramQ.trim()) return 'relevance'
    if (Number.isFinite(categoryId)) return 'newest'
    return 'newest'
  })
  const [showSort, setShowSort] = useState(false)
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

  const [products, setProducts] = useState<Product[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const isFeaturedMode =
    !Number.isFinite(categoryId) && debouncedQuery.length === 0

  const sortOptions = useMemo((): StorefrontSort[] => {
    if (debouncedQuery.trim()) {
      return ['relevance', 'newest', 'best_seller', 'price_asc', 'price_desc', 'rating']
    }
    if (Number.isFinite(categoryId)) {
      return ['newest', 'best_seller', 'price_asc', 'price_desc', 'rating']
    }
    return ['relevance', 'newest', 'best_seller', 'price_asc', 'price_desc', 'rating']
  }, [debouncedQuery, categoryId])

  useEffect(() => {
    if (paramQ) setSearchQuery(paramQ)
  }, [paramQ])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 450)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (categoryId == null || !Number.isFinite(categoryId)) {
      setCategoryName(null)
      return
    }
    const id = categoryId
    void categoryService
      .getCategoryById(id)
      .then((r: { success?: boolean; category?: { name: string } }) => {
        if (r?.category?.name) setCategoryName(r.category.name)
      })
      .catch(() => setCategoryName(null))
  }, [categoryId])

  useEffect(() => {
    const p = parseSortParam(params.sortBy)
    if (p) {
      if (p === 'relevance' && !debouncedQuery.trim() && !Number.isFinite(categoryId)) {
        setSortBy('newest')
      } else {
        setSortBy(p)
      }
    }
  }, [params.sortBy, debouncedQuery, categoryId])

  useEffect(() => {
    if (sortBy === 'relevance' && !debouncedQuery.trim() && !Number.isFinite(categoryId)) {
      setSortBy('newest')
    }
  }, [debouncedQuery, categoryId, sortBy])

  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true)
    try {
      const response = await productService.getProducts({
        sortBy: 'best_seller',
        pageSize: DEFAULT_PAGE_SIZE,
      })
      setFeaturedProducts(response.products || [])
    } catch {
      // ignore
    } finally {
      setFeaturedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isFeaturedMode) return
    void loadFeatured()
  }, [isFeaturedMode, loadFeatured])

  const loadList = useCallback(
    async (pageNum: number, isRefresh: boolean) => {
      if (isRefresh) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const effectiveSort: StorefrontSort =
        sortBy === 'relevance' && !debouncedQuery.trim() ? 'newest' : sortBy

      try {
        const res = await productService.getProducts({
          page: pageNum,
          pageSize: DEFAULT_PAGE_SIZE,
          search: debouncedQuery || undefined,
          categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
          sortBy: effectiveSort,
          minPrice: appliedMinPrice,
          maxPrice: appliedMaxPrice,
          minRating: appliedMinRating,
        })

        if (isRefresh) {
          setProducts(res.products)
        } else {
          setProducts((prev) => [...prev, ...res.products])
        }
        setHasMore(res.products.length === DEFAULT_PAGE_SIZE)
      } catch (e) {
        console.error('Search load failed', e)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      debouncedQuery,
      categoryId,
      sortBy,
      appliedMinPrice,
      appliedMaxPrice,
      appliedMinRating,
    ]
  )

  useEffect(() => {
    if (isFeaturedMode) {
      setProducts([])
      return
    }
    setPage(1)
    void loadList(1, true)
  }, [
    isFeaturedMode,
    debouncedQuery,
    categoryId,
    sortBy,
    appliedMinPrice,
    appliedMaxPrice,
    appliedMinRating,
    loadList,
  ])

  const handleLoadMore = () => {
    if (isFeaturedMode) return
    if (!loadingMore && hasMore) {
      const next = page + 1
      setPage(next)
      void loadList(next, false)
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

  const displayProducts = isFeaturedMode ? featuredProducts : products
  const isLoading = isFeaturedMode ? featuredLoading : loading
  const showEmptySearch =
    !isFeaturedMode && !loading && debouncedQuery.length > 0 && products.length === 0

  const listHeader = !isFeaturedMode && Number.isFinite(categoryId) && categoryName ? (
    <View style={styles.subHeaderBar}>
      <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} />
      <Text style={styles.subHeaderText} numberOfLines={1}>
        {categoryName}
      </Text>
    </View>
  ) : null

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
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            autoFocus={!paramQ}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('')
                searchInputRef.current?.clear()
              }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(!isFeaturedMode || searchQuery.length > 0 || Number.isFinite(categoryId)) && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              setShowSort(!showSort)
              setShowFilters(false)
            }}
          >
            <Text style={styles.filterButtonText}>{SORT_LABELS[sortBy] || 'Sắp xếp'}</Text>
            <Ionicons
              name={showSort ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              setShowFilters(!showFilters)
              setShowSort(false)
            }}
          >
            <Ionicons name="funnel-outline" size={18} color={COLORS.text} />
            <Text style={styles.filterButtonText}>Lọc giá / đánh giá</Text>
          </TouchableOpacity>
        </View>
      )}

      {showSort && (
        <View style={styles.sortBox}>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.sortRow, sortBy === opt && styles.sortRowActive]}
              onPress={() => {
                setSortBy(opt)
                setShowSort(false)
              }}
            >
              <Text
                style={[styles.sortRowText, sortBy === opt && { color: COLORS.primary, fontWeight: '600' }]}
              >
                {SORT_LABELS[opt]}
              </Text>
              {sortBy === opt && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showFilters && !isFeaturedMode && (
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
          onEndReached={!isFeaturedMode ? handleLoadMore : undefined}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <>
              {listHeader}
              {isFeaturedMode && displayProducts.length > 0 ? (
                <View style={styles.sectionHeader}>
                  <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.sectionTitle}>Sản phẩm bán chạy</Text>
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            !isFeaturedMode && loadingMore ? (
              <View style={styles.loadMorePad}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {showEmptySearch ? (
                <>
                  <Ionicons name="file-tray-outline" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
                  <Text style={styles.emptySubtext}>Thử từ khóa hoặc bộ lọc khác</Text>
                </>
              ) : isFeaturedMode ? (
                <>
                  <Ionicons name="search" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Chưa có sản phẩm nào</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>Không có kết quả</Text>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    gap: SIZES.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SIZES.sm,
    borderRadius: 8,
    gap: 4,
  },
  filterButtonText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  sortBox: {
    marginHorizontal: SIZES.lg,
    marginBottom: SIZES.sm,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortRowActive: {
    backgroundColor: COLORS.background,
  },
  sortRowText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
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
  filterDash: { color: COLORS.textSecondary },
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
  subHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SIZES.md,
    paddingHorizontal: 2,
  },
  subHeaderText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
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
  loadMorePad: {
    paddingVertical: SIZES.lg,
    alignItems: 'center',
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
