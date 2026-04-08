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
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'

import { useAuthStore } from '@/store/auth-store'
import { useChatStore } from '@/store/chat-store'
import { conversationService } from '@/services/conversation-service'
import { supabase } from '@/lib/supabase'
import { useChatRealtime, useChatRealtimeContext } from '@/contexts/chat-realtime-context'
import type { ChatMessageDto, ConversationDto } from '@/types/conversation'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ConversationChatScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const conversationId = params.conversationId as string
  const { isAuthenticated, user } = useAuthStore()
  const { setActiveConversationId } = useChatRealtimeContext()
  const { messagesByConversation, conversationsById, loadMessages, addMessage, setConversationDetail } =
    useChatStore()
  const listRef = useRef<FlatList>(null)
  const msgInputRef = useRef<TextInput>(null)
  const userIdRef = useRef(user?.id)
  userIdRef.current = user?.id

  const conversation: ConversationDto | null = conversationsById[conversationId] || null
  const messages: ChatMessageDto[] = messagesByConversation[conversationId] || []
  const [input, setInput] = useState('')
  // Optimize initial loading visualization by checking if we have cache
  const [loading, setLoading] = useState(!messages.length)
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const load = useCallback(async () => {
    if (!conversationId || !isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      const detail = await conversationService.getMessages(conversationId, 1, 100)
      setConversationDetail(conversationId, detail.conversation)
      const sorted = [...(detail.messages || [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      loadMessages(conversationId, sorted)
      await conversationService.markAsRead(conversationId)
    } catch (e: any) {
      console.warn('Silent load fail or Network issue:', e?.message)
    } finally {
      setLoading(false)
    }
  }, [conversationId, isAuthenticated, loadMessages, setConversationDetail])

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
      addMessage(conversationId, message)
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
    if (!loading && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200)
    }
  }, [messages.length, loading])

  const handleSendText = async () => {
    const text = input.trim()
    if (!text || sending || uploadingImage || !conversationId) return
    msgInputRef.current?.clear()
    setInput('')
    
    // Optimistic UI
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
    
    addMessage(conversationId, optimistic)
    setSending(true)
    
    try {
      const saved = await conversationService.sendMessage(conversationId, text)
      addMessage(conversationId, saved)
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi thất bại')
      // Note: Ideally remove optimistic from store on fail
    } finally {
      setSending(false)
      // trigger refresh quietly to sync IDs and states properly
      load() 
    }
  }

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để gửi hình.')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Lỗi', 'Ảnh quá lớn. Dung lượng tối đa 5 MB')
        return
      }

      setUploadingImage(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Yêu cầu đăng nhập để gửi ảnh')

      const ext = asset.uri.split('.').pop() || 'jpg'
      const fileName = `chat-${Date.now()}.${ext}`
      const storagePath = `chat_attachments/${user.id}/${fileName}`

      // Fetch blob & Upload using decode
      const arrayBuffer = decode(asset.base64!)

      const { error: uploadError } = await supabase.storage
        .from('image')
        .upload(storagePath, arrayBuffer, {
          cacheControl: '31536000',
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        })

      if (uploadError) throw uploadError

      // Fetch public link
      const { data: { publicUrl } } = supabase.storage
        .from('image')
        .getPublicUrl(storagePath)

      // Send to Chat Server
      const saved = await conversationService.sendMessage(conversationId, publicUrl, 'image')
      addMessage(conversationId, saved)
      
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể gửi ảnh')
    } finally {
      setUploadingImage(false)
      load()
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

  const renderItem = ({ item }: { item: ChatMessageDto }) => {
    const isBuyer = item.senderRole === 'buyer'
    const isImage =
      item.messageType === 'image' ||
      (item.content.startsWith('http') && item.content.match(/\.(jpeg|jpg|gif|png|webp)/i))

    return (
      <View style={[styles.bubbleWrap, isBuyer ? styles.alignEnd : styles.alignStart]}>
        {!isBuyer && (
          <Text style={styles.senderName} numberOfLines={1}>
            {item.senderName}
          </Text>
        )}
        <View style={[styles.bubble, isBuyer ? styles.bubbleUser : styles.bubbleOther, isImage && styles.bubbleImageContainer]}>
          {isImage ? (
            <Image source={{ uri: item.content }} style={styles.messageImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.bubbleText, isBuyer && styles.bubbleTextUser]}>{item.content}</Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, SIZES.xxl) + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conversation?.shopName || 'Đang tải...'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onLayout={() => {
             // Scroll to end when layout finishes
             if(messages.length > 0) {
               listRef.current?.scrollToEnd({animated: false})
             }
          }}
        />
      )}

      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, SIZES.md) }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} disabled={uploadingImage || sending}>
           {uploadingImage ? (
             <ActivityIndicator color={COLORS.primary} size="small" />
           ) : (
             <Ionicons name="image" size={28} color={COLORS.primary} />
           )}
        </TouchableOpacity>
        
        <TextInput
          ref={msgInputRef}
          style={styles.input}
          placeholder="Nhập tin nhắn…"
          placeholderTextColor={COLORS.textSecondary}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending && !uploadingImage}
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending || uploadingImage) && styles.sendDisabled]}
          onPress={handleSendText}
          disabled={!input.trim() || sending || uploadingImage}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.sm,
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
    maxWidth: '85%',
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
  bubbleImageContainer: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  messageImage: {
    width: 200,
    height: 250,
    borderRadius: 12,
    backgroundColor: COLORS.placeholder,
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
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.sm,
    gap: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  attachBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.md,
    paddingVertical: 12,
    fontSize: FONTS.size.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
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
