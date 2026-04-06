import React, { useState, useEffect } from 'react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setProducts([])
        setSearched(false)
        return
      }

      setLoading(true)
      setSearched(true)
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
  }, [searchQuery])

  const handleManualSubmit = () => {
  }

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
            style={styles.searchInput}
            placeholder="Tìm kiếm sản phẩm..."
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleManualSubmit}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!searched ? (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Tìm kiếm sản phẩm yêu thích của bạn</Text>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
              <Text style={styles.emptySubtext}>Thử tìm kiếm với từ khóa khác</Text>
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
