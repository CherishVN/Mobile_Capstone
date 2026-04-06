import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth-store'
import { useChatStore } from '@/store/chat-store'
import { conversationService } from '@/services/conversation-service'
import type { ConversationDto } from '@/types/conversation'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

function formatTime(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  if (sameDay) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function MessagesListScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { conversationsList, setConversationsList } = useChatStore()
  
  const [loading, setLoading] = useState(conversationsList.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await conversationService.listMine()
      setConversationsList(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [setConversationsList])

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        if (conversationsList.length === 0) setLoading(true)
        load()
      } else {
        setLoading(false)
      }
    }, [isAuthenticated, load, conversationsList.length])
  )

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.text} />
            <Text style={styles.headerTitle}>Chat</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.guest}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.primary} />
          <Text style={styles.guestTitle}>Đăng nhập để chat với cửa hàng</Text>
          <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.guestBtn} />
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  const renderItem = ({ item }: { item: ConversationDto }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => router.push(`/messages/${item.id}` as Href)}
    >
      {item.shopLogoUrl ? (
        <Image source={{ uri: item.shopLogoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPh]}>
          <Ionicons name="storefront-outline" size={26} color={COLORS.primary} />
        </View>
      )}
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.shopName} numberOfLines={1}>
            {item.shopName}
          </Text>
          {item.lastMessage && (
            <Text style={styles.time}>{formatTime(item.lastMessage.createdAt)}</Text>
          )}
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage?.content || 'Chưa có tin nhắn'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.text} />
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading && conversationsList.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversationsList}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={conversationsList.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Chưa có hội thoại nào. Mở cửa hàng và chọn «Chat với shop».
            </Text>
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.sm,
    paddingTop: SIZES.xxl + 6,
    paddingBottom: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  list: {
    flex: 1,
    backgroundColor: COLORS.chatBackground,
  },
  guest: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  guestTitle: {
    marginTop: SIZES.lg,
    fontSize: FONTS.size.md,
    color: COLORS.text,
    textAlign: 'center',
  },
  guestBtn: {
    marginTop: SIZES.xl,
    minWidth: 200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8de',
    backgroundColor: COLORS.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: SIZES.md,
  },
  avatarPh: {
    backgroundColor: COLORS.chatBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopName: {
    flex: 1,
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: SIZES.sm,
  },
  time: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  preview: {
    flex: 1,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: SIZES.sm,
  },
  badgeText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.xs,
    fontWeight: '700',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.xl,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
  },
})
