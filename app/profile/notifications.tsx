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
import { notificationService } from '@/services/notification-service'
import { AppNotification } from '@/types/notification'
import { useAuthStore } from '@/store/auth-store'
import Loading from '@/components/Loading'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function NotificationsScreen() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    if (!isAuthenticated) {
      setItems([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const res = await notificationService.getNotifications({ pageSize: 50 })
      if (res.success) setItems(res.notifications || [])
    } catch (e) {
      console.error('Notifications:', e)
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [isAuthenticated])

  const onPressItem = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await notificationService.markAsRead(n.id)
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        )
      } catch {
        /* empty */
      }
    }
    if (n.referenceType === 'Order' && n.referenceId) {
      router.push(`/orders/${n.referenceId}`)
    }
  }

  const markAll = async () => {
    try {
      await notificationService.markAllRead()
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })))
    } catch {
      /* empty */
    }
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.hint}>Đăng nhập để xem thông báo</Text>
          <Button title="Đăng nhập" onPress={() => router.replace('/auth/login')} />
        </View>
      </View>
    )
  }

  if (loading && !refreshing) {
    return <Loading />
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        {items.some((x) => !x.isRead) ? (
          <TouchableOpacity onPress={markAll} style={styles.markAll}>
            <Text style={styles.markAllText}>Đọc hết</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Chưa có thông báo</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.isRead && styles.cardUnread]}
            onPress={() => onPressItem(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <Text style={styles.title}>{item.title}</Text>
              {!item.isRead && <View style={styles.dot} />}
            </View>
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString('vi-VN')}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SIZES.xs, marginRight: SIZES.sm },
  headerTitle: { flex: 1, fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  headerRight: { width: 56 },
  markAll: { paddingVertical: SIZES.xs },
  markAllText: { color: COLORS.primary, fontWeight: '600', fontSize: FONTS.size.sm },
  list: { padding: SIZES.lg, paddingBottom: SIZES.xxl },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: { borderColor: COLORS.primary, backgroundColor: COLORS.background },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { flex: 1, fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: SIZES.sm },
  content: { marginTop: SIZES.sm, fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 20 },
  time: { marginTop: SIZES.sm, fontSize: FONTS.size.xs, color: COLORS.placeholder },
  empty: { alignItems: 'center', paddingVertical: SIZES.xxl * 2 },
  emptyText: { marginTop: SIZES.md, color: COLORS.textSecondary },
  center: { flex: 1, justifyContent: 'center', padding: SIZES.xl, gap: SIZES.lg },
  hint: { textAlign: 'center', color: COLORS.text, fontSize: FONTS.size.md },
})
