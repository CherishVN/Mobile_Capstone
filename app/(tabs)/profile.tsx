import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { userService } from '@/services/user-service'
import { useAuthStore } from '@/store/auth-store'
import { UserProfile } from '@/types/user'
import Loading from '@/components/Loading'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const { signOut, isAuthenticated } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadProfile = async () => {
    try {
      const response = await userService.getProfile()
      if (response.success && response.data) {
        setProfile(response.data)
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadProfile()
  }, [isAuthenticated])

  const onRefresh = () => {
    setRefreshing(true)
    loadProfile()
  }

  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/auth/login')
        },
      },
    ])
  }

  if (loading && isAuthenticated) {
    return <Loading />
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tài khoản</Text>
        </View>
        <View style={styles.guestWrap}>
          <Ionicons name="person-circle-outline" size={80} color={COLORS.textSecondary} />
          <Text style={styles.guestTitle}>Đăng nhập để quản lý tài khoản</Text>
          <Text style={styles.guestSub}>Địa chỉ, đơn hàng và cài đặt cá nhân.</Text>
          <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.guestBtn} />
          <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.registerLink}>
            <Text style={styles.registerLinkText}>Chưa có tài khoản? Đăng ký</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const menuItems = [
    {
      icon: 'person-outline' as const,
      title: 'Thông tin cá nhân',
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: 'location-outline' as const,
      title: 'Địa chỉ giao hàng',
      onPress: () => router.push('/profile/addresses'),
    },
    {
      icon: 'heart-outline' as const,
      title: 'Sản phẩm yêu thích',
      onPress: () => router.push('/profile/favorites' as Href),
    },
    {
      icon: 'lock-closed-outline' as const,
      title: 'Đổi mật khẩu',
      onPress: () => router.push('/profile/change-password'),
    },
    {
      icon: 'notifications-outline' as const,
      title: 'Thông báo',
      onPress: () => router.push('/profile/notifications' as Href),
    },
    {
      icon: 'sparkles-outline' as const,
      title: 'Trợ lý mua hàng (AI)',
      onPress: () => router.push('/assistant' as Href),
    },
    {
      icon: 'chatbubbles-outline' as const,
      title: 'Chat',
      onPress: () => router.push('/messages' as Href),
    },
    {
      icon: 'help-circle-outline' as const,
      title: 'Trợ giúp & Hỗ trợ',
      onPress: () => Alert.alert('Trợ giúp', 'Tính năng đang phát triển'),
    },
  ]

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tài khoản</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.fullName || 'Người dùng'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.section}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name={item.icon} size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Phiên bản 1.0.0</Text>
        </View>
      </ScrollView>
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
  profileCard: {
    alignItems: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.card,
    marginBottom: SIZES.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  avatarText: {
    fontSize: FONTS.size.xxxl,
    fontWeight: 'bold',
    color: COLORS.onPrimary,
  },
  name: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  email: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.card,
    marginBottom: SIZES.sm,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
    gap: SIZES.sm,
  },
  signOutText: {
    fontSize: FONTS.size.md,
    color: COLORS.error,
    fontWeight: '600',
  },
  versionContainer: {
    alignItems: 'center',
    padding: SIZES.lg,
  },
  versionText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  guestWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  guestTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
  guestSub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
    textAlign: 'center',
  },
  guestBtn: {
    marginTop: SIZES.xl,
    minWidth: 200,
  },
  registerLink: {
    marginTop: SIZES.lg,
  },
  registerLinkText: {
    fontSize: FONTS.size.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
})
