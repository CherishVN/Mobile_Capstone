import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AiSessionSummary, SessionFilter } from '@/types/ai-chat'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

function truncate(s: string, max: number) {
  if (!s) return ''
  return s.length > max ? s.slice(0, max).trim() + '…' : s
}

function formatSessionTime(iso?: string) {
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

function filterLabel(f: SessionFilter) {
  if (f === 'unread') return 'Chưa đọc'
  if (f === 'muted') return 'Đã tắt TB'
  return 'Tất cả'
}

interface Props {
  sessions: AiSessionSummary[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
  onOpenSession: (sessionId: string) => void
  onNewChat: () => void
  onMarkRead: (sessionId: string) => void
  onToggleMute: (sessionId: string, nextMuted: boolean) => void
  onDelete: (sessionId: string) => void
}

export default function SessionListView({
  sessions,
  loading,
  refreshing,
  onRefresh,
  onOpenSession,
  onNewChat,
  onMarkRead,
  onToggleMute,
  onDelete,
}: Props) {
  const [search, setSearch] = useState('')
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)

  const visible = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return sessions.filter((s) => {
      if (kw) {
        const t = (s.title || '').toLowerCase()
        const p = (s.lastMessage?.content || '').toLowerCase()
        if (!t.includes(kw) && !p.includes(kw)) return false
      }
      if (sessionFilter === 'unread') return (s.unreadCount ?? 0) > 0
      if (sessionFilter === 'muted') return !!s.isMuted
      return true
    })
  }, [sessions, search, sessionFilter])

  const sessionMenu = (s: AiSessionSummary) => {
    Alert.alert(s.title || 'Phiên chat', undefined, [
      { text: 'Đánh dấu đã đọc', onPress: () => onMarkRead(s.sessionId) },
      {
        text: s.isMuted ? 'Bật thông báo' : 'Tắt thông báo',
        onPress: () => onToggleMute(s.sessionId, !s.isMuted),
      },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Xóa phiên?', 'Không hoàn tác.', [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa', style: 'destructive', onPress: () => onDelete(s.sessionId) },
          ])
        },
      },
      { text: 'Đóng', style: 'cancel' },
    ])
  }

  if (loading && sessions.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.hint}>Đang tải phiên chat…</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tiêu đề hoặc nội dung"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterOpen((v) => !v)}
        >
          <Ionicons name="funnel-outline" size={18} color={COLORS.text} />
          <Text style={styles.filterBtnText}>{filterLabel(sessionFilter)}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {filterOpen && (
        <View style={styles.filterChips}>
          {(['all', 'unread', 'muted'] as SessionFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, sessionFilter === f && styles.chipOn]}
              onPress={() => {
                setSessionFilter(f)
                setFilterOpen(false)
              }}
            >
              <Text style={[styles.chipText, sessionFilter === f && styles.chipTextOn]}>
                {filterLabel(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.newRow} onPress={onNewChat} activeOpacity={0.85}>
        <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
        <Text style={styles.newRowText}>Cuộc trò chuyện mới</Text>
      </TouchableOpacity>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.sessionId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {sessions.length === 0
                ? 'Chưa có cuộc trò chuyện nào'
                : 'Không có phiên phù hợp bộ lọc'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unread = Math.max(0, item.unreadCount ?? 0)
          return (
            <View style={[styles.row, item.isMuted && styles.rowMuted]}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => onOpenSession(item.sessionId)}
                activeOpacity={0.75}
              >
                <View style={styles.rowAvatar}>
                  <Ionicons name="sparkles" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {truncate(item.title, 32)}
                  </Text>
                  {item.lastMessage && (
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {item.lastMessage.role === 'user' ? 'Bạn: ' : 'Trợ lý: '}
                      {truncate(item.lastMessage.content, 40)}
                    </Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  {item.isMuted && (
                    <Ionicons name="notifications-off-outline" size={14} color={COLORS.textSecondary} />
                  )}
                  {unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  )}
                  <Text style={styles.rowTime}>
                    {formatSessionTime(item.updatedAt || item.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowMenu}
                onPress={() => sessionMenu(item)}
                hitSlop={10}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.chatBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.chatBackground },
  hint: { marginTop: SIZES.md, color: COLORS.textSecondary, fontSize: FONTS.size.sm },
  toolbar: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    gap: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8de',
    backgroundColor: COLORS.chatBackground,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.md,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: FONTS.size.sm, color: COLORS.text, paddingVertical: SIZES.sm },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnText: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, paddingHorizontal: SIZES.md, paddingBottom: SIZES.sm },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipOn: { backgroundColor: COLORS.chatRowHighlight, borderColor: COLORS.primary },
  chipText: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.primary, fontWeight: '700' },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8de',
  },
  newRowText: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.primary },
  empty: { padding: SIZES.xxl, alignItems: 'center' },
  emptyText: { marginTop: SIZES.md, color: COLORS.textSecondary, textAlign: 'center', fontSize: FONTS.size.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8de',
    backgroundColor: COLORS.card,
  },
  rowMuted: { opacity: 0.85 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.md, paddingLeft: SIZES.md },
  rowMenu: { justifyContent: 'center', paddingHorizontal: SIZES.sm },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.chatRowHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.md,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: FONTS.size.sm, fontWeight: '700', color: COLORS.text },
  rowPreview: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 4, marginRight: SIZES.xs },
  rowTime: { fontSize: 10, color: COLORS.textSecondary },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: COLORS.onPrimary, fontSize: 9, fontWeight: '800' },
})
