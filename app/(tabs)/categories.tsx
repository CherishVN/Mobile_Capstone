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

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

/** Trả về icon phù hợp với tên danh mục (khớp keyword, không phân biệt hoa thường) */
function getCategoryIcon(name: string): IoniconName {
  const n = name.toLowerCase()

  if (/điện thoại|smartphone|mobile/.test(n)) return 'phone-portrait-outline'
  if (/laptop|máy tính|macbook|notebook/.test(n)) return 'laptop-outline'
  if (/máy ảnh|camera/.test(n)) return 'camera-outline'
  if (/tivi|tv|màn hình|màn ảnh/.test(n)) return 'tv-outline'
  if (/tai nghe|loa|âm thanh|headphone/.test(n)) return 'headset-outline'
  if (/máy tính bảng|tablet|ipad/.test(n)) return 'tablet-portrait-outline'
  if (/đồng hồ|watch/.test(n)) return 'watch-outline'
  if (/điện tử|điện gia dụng|thiết bị/.test(n)) return 'hardware-chip-outline'
  if (/phụ kiện/.test(n)) return 'extension-puzzle-outline'

  if (/quần áo|thời trang|may mặc|áo|quần|váy|đầm/.test(n)) return 'shirt-outline'
  if (/giày|dép|sandal|sneaker/.test(n)) return 'footsteps-outline'
  if (/túi|balo|ví|handbag|backpack/.test(n)) return 'bag-handle-outline'
  if (/nón|mũ|hat/.test(n)) return 'accessibility-outline'
  if (/trang sức|nhẫn|vòng|dây chuyền|đá quý/.test(n)) return 'diamond-outline'

  if (/mỹ phẩm|làm đẹp|skincare|son|kem|nước hoa|beauty/.test(n)) return 'color-palette-outline'
  if (/chăm sóc tóc|tóc|hair/.test(n)) return 'cut-outline'

  if (/bách hóa|tạp hóa|siêu thị|grocery/.test(n)) return 'basket-outline'
  if (/thực phẩm|đồ ăn|ăn uống|thức ăn|food|nông sản|rau|củ|quả|hạt/.test(n)) return 'nutrition-outline'
  if (/bánh|kẹo|snack|đồ ngọt/.test(n)) return 'cafe-outline'
  if (/đồ uống|nước|bia|rượu|drink/.test(n)) return 'beer-outline'

  if (/thú cưng|chó|mèo|pet|thú nuôi/.test(n)) return 'paw-outline'
  if (/đồ chơi|toy|game controller/.test(n)) return 'game-controller-outline'
  if (/trẻ em|em bé|baby|mẹ & bé|sơ sinh/.test(n)) return 'happy-outline'

  if (/sách|văn học|kiến thức|book/.test(n)) return 'book-outline'
  if (/văn phòng phẩm|bút|giấy|stationery/.test(n)) return 'pencil-outline'

  if (/thể thao|gym|fitness|yoga|bóng|sport/.test(n)) return 'barbell-outline'
  if (/ngoài trời|outdoor|cắm trại|leo núi/.test(n)) return 'trail-sign-outline'
  if (/du lịch|travel|vali/.test(n)) return 'airplane-outline'

  if (/ô tô|xe hơi|car|mô tô|xe máy|phụ tùng/.test(n)) return 'car-outline'

  if (/nội thất|sofa|giường|bàn ghế|tủ|furniture/.test(n)) return 'bed-outline'
  if (/nhà bếp|bếp|nồi|chảo|dụng cụ nhà bếp/.test(n)) return 'restaurant-outline'
  if (/đèn|chiếu sáng|light/.test(n)) return 'bulb-outline'
  if (/vệ sinh|tẩy rửa|cleaning/.test(n)) return 'sparkles-outline'
  if (/cây|hoa|vườn|garden/.test(n)) return 'leaf-outline'
  if (/gia dụng|home|nhà cửa|nội thất/.test(n)) return 'home-outline'

  if (/sức khỏe|y tế|thuốc|vitamin|health/.test(n)) return 'medkit-outline'
  if (/thể dục|dưỡng sinh|wellness/.test(n)) return 'heart-outline'

  if (/nhạc cụ|âm nhạc|guitar|piano|music/.test(n)) return 'musical-notes-outline'
  if (/nghệ thuật|mỹ thuật|vẽ|art/.test(n)) return 'brush-outline'

  return 'pricetag-outline'
}

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
              <Ionicons name={getCategoryIcon(item.name)} size={24} color={COLORS.primary} />
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
