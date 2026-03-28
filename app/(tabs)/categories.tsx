import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { categoryService } from '@/services/category-service'
import { Category } from '@/types/category'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function CategoriesScreen() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadCategories = async () => {
    try {
      const response = await categoryService.getCategories()
      setCategories((response.categories || []).filter((c) => c.level === 1 && !c.parentId))
    } catch (error: any) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadCategories()
  }

  if (loading) {
    return <Loading />
  }

  const renderCategory = ({ item }: { item: Category }) => {
    const isParent = !item.parentId
    const children = categories.filter((c) => c.parentId === item.id)

    if (!isParent) return null

    return (
      <View style={styles.categorySection}>
        <TouchableOpacity
          style={styles.parentCategory}
          onPress={() => router.push(`/products?categoryId=${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryLeft}>
            <View style={styles.iconContainer}>
              <Ionicons name="pricetag" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.parentName}>{item.name}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {children.length > 0 && (
          <View style={styles.childrenContainer}>
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={styles.childCategory}
                onPress={() => router.push(`/products?categoryId=${child.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.childName}>{child.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    )
  }

  const parentCategories = categories.filter((c) => !c.parentId)

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Danh mục</Text>
      </View>

      <FlatList
        data={parentCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có danh mục nào</Text>
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
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.lg,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  listContent: {
    padding: SIZES.lg,
  },
  categorySection: {
    marginBottom: SIZES.lg,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  parentCategory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentName: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  childrenContainer: {
    backgroundColor: COLORS.background,
    paddingVertical: SIZES.xs,
  },
  childCategory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  childName: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
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
