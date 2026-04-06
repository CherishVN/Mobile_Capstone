import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth-store'
import { conversationService } from '@/services/conversation-service'
import { useChatRealtime, useChatRealtimeContext } from '@/contexts/chat-realtime-context'
import type { ChatMessageDto, ConversationDto } from '@/types/conversation'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function ConversationChatScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const conversationId = params.conversationId as string
  const { isAuthenticated, user } = useAuthStore()
  const { setActiveConversationId } = useChatRealtimeContext()
  const listRef = useRef<FlatList>(null)
  const userIdRef = useRef(user?.id)
  userIdRef.current = user?.id

  const [conversation, setConversation] = useState<ConversationDto | null>(null)
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!conversationId) {
      setLoading(false)
      return
    }
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const detail = await conversationService.getMessages(conversationId, 1, 100)
      setConversation(detail.conversation)
      const sorted = [...(detail.messages || [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      setMessages(sorted)
      await conversationService.markAsRead(conversationId)
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tải được tin nhắn')
    } finally {
      setLoading(false)
    }
  }, [conversationId, isAuthenticated])

  useEffect(() => {
    load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      setActiveConversationId(conversationId)
      return () => setActiveConversationId(null)
    }, [conversationId, setActiveConversationId])
  )

  const loadRef = useRef(load)
  loadRef.current = load

  useChatRealtime({
    onChatMessageReceived: ({ conversationId: cid, message }) => {
      if (!message || cid !== conversationId) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev
        return [...prev, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
      const uid = userIdRef.current
      if (uid && message.senderId !== uid) {
        void conversationService.markAsRead(conversationId)
      }
    },
    onReconnected: () => {
      void loadRef.current()
    },
  })

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 200)
  }, [messages.length, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || sending || !conversationId) return
    setInput('')
    const optimistic: ChatMessageDto = {
      id: `tmp-${Date.now()}`,
      conversationId,
      senderId: '',
      senderName: 'Bạn',
      senderRole: 'buyer',
      messageType: 'text',
      content: text,
      isRead: true,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setSending(true)
    try {
      const saved = await conversationService.sendMessage(conversationId, text)
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimistic.id && m.id !== saved.id)
        return [...without, saved].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi thất bại')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  const renderItem = ({ item }: { item: ChatMessageDto }) => {
    const isBuyer = item.senderRole === 'buyer'
    return (
      <View style={[styles.bubbleWrap, isBuyer ? styles.alignEnd : styles.alignStart]}>
        {!isBuyer && (
          <Text style={styles.senderName} numberOfLines={1}>
            {item.senderName}
          </Text>
        )}
        <View style={[styles.bubble, isBuyer ? styles.bubbleUser : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isBuyer && styles.bubbleTextUser]}>{item.content}</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conversation?.shopName || 'Cửa hàng'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn…"
          placeholderTextColor={COLORS.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.onPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.text,
    marginHorizontal: SIZES.sm,
  },
  list: {
    flex: 1,
    backgroundColor: COLORS.chatBackground,
  },
  listContent: {
    padding: SIZES.lg,
    paddingBottom: SIZES.xl,
  },
  bubbleWrap: {
    marginBottom: SIZES.md,
    maxWidth: '88%',
  },
  alignEnd: {
    alignSelf: 'flex-end',
  },
  alignStart: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
  },
  bubbleOther: {
    backgroundColor: COLORS.chatBubbleAssistant,
    borderWidth: 1,
    borderColor: COLORS.chatBubbleBorder,
  },
  bubbleText: {
    fontSize: FONTS.size.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: COLORS.onPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SIZES.md,
    gap: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: FONTS.size.md,
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
})
