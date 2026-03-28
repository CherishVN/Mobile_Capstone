import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { userService } from '@/services/user-service'
import { Address } from '@/types/user'
import Button from '@/components/Button'
import Loading from '@/components/Loading'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function AddressesScreen() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadAddresses = async () => {
    try {
      const response = await userService.getAddresses()
      if (response.success && response.data) {
        setAddresses(response.data)
      }
    } catch (error: any) {
      console.error('Failed to load addresses:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAddresses()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadAddresses()
  }

  const handleSetDefault = async (addressId: string) => {
    try {
      await userService.setDefaultAddress(addressId)
      await loadAddresses()
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể đặt làm mặc định')
    }
  }

  const handleDelete = (addressId: string) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(addressId)
          try {
            await userService.deleteAddress(addressId)
            await loadAddresses()
          } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể xóa địa chỉ')
          } finally {
            setDeletingId(null)
          }
        },
      },
    ])
  }

  const formatAddress = (address: Address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.ward,
      address.district,
      address.city,
      address.province,
    ].filter(Boolean)
    return parts.join(', ')
  }

  if (loading) {
    return <Loading />
  }

  const renderAddress = ({ item }: { item: Address }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressInfo}>
          {item.label && <Text style={styles.label}>{item.label}</Text>}
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
        </View>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Mặc định</Text>
          </View>
        )}
      </View>

      <Text style={styles.addressText}>{formatAddress(item)}</Text>

      <View style={styles.addressActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.actionText}>Đặt mặc định</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => Alert.alert('Thông báo', 'Tính năng chỉnh sửa đang phát triển')}
        >
          <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          <Text style={styles.actionText}>Chỉnh sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}
          disabled={deletingId === item.id}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          <Text style={[styles.actionText, { color: COLORS.error }]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Địa chỉ giao hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={addresses}
        renderItem={renderAddress}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có địa chỉ nào</Text>
            <Text style={styles.emptySubtext}>Thêm địa chỉ để dễ dàng đặt hàng</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          title="Thêm địa chỉ mới"
          onPress={() => Alert.alert('Thông báo', 'Tính năng thêm địa chỉ đang phát triển')}
          fullWidth
          size="lg"
          icon={<Ionicons name="add" size={20} color={COLORS.background} />}
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
  listContent: {
    padding: SIZES.lg,
  },
  addressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.md,
  },
  addressInfo: {
    flex: 1,
  },
  label: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SIZES.xs,
  },
  name: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  phone: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  defaultBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 6,
  },
  defaultText: {
    fontSize: FONTS.size.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addressText: {
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SIZES.md,
  },
  addressActions: {
    flexDirection: 'row',
    gap: SIZES.md,
    paddingTop: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  actionText: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SIZES.xxl * 2,
  },
  emptyText: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: SIZES.md,
  },
  emptySubtext: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
  },
  footer: {
    padding: SIZES.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
})
