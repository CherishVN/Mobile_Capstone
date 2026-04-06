import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth-store'
import { aiChatService } from '@/services/ai-chat-service'
import { productService } from '@/services/product-service'
import type { AssistantUiMessage, ProductSuggestion } from '@/types/ai-chat'
import { useCart } from '@/hooks/useCart'
import Button from '@/components/Button'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const SUGGESTION_CHIPS = [
  'Áo thun nam dưới 200k',
  'Son môi đỏ đẹp',
  'Laptop gaming tầm 15 triệu',
]

function formatPrice(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ'
}

export default function AssistantScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { addToCart } = useCart()
  const listRef = useRef<FlatList>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantUiMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingSession, setLoadingSession] = useState(true)
  const [sending, setSending] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const bootstrap = useCallback(async () => {
    setLoadingSession(true)
    try {
      const res = await aiChatService.getOrCreateSession()
      const sid = res.sessionId
      setSessionId(sid)
      const hist = (res.history || []).map((m) => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      }))
      setMessages(hist)
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không kết nối được trợ lý AI. Kiểm tra EXPO_PUBLIC_AI_URL.')
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) bootstrap()
    else setLoadingSession(false)
  }, [isAuthenticated, bootstrap])

  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  useEffect(() => {
    scrollToEnd()
  }, [messages.length])

  const openProduct = async (productId: string) => {
    try {
      const res = await productService.getProductById(productId)
      if (res.success && res.product?.slug) {
        router.push(`/products/${res.product.slug}`)
      } else {
        Alert.alert('Sản phẩm', 'Không mở được trang sản phẩm.')
      }
    } catch {
      Alert.alert('Sản phẩm', 'Không tải được thông tin sản phẩm.')
    }
  }

  const handleAddSuggested = async (p: ProductSuggestion, variantId?: string) => {
    const vid = variantId || p.variants?.[0]?.id
    setAddingId(p.id)
    const r = await addToCart(p.id, vid, 1)
    setAddingId(null)
    if (r.success) Alert.alert('Giỏ hàng', 'Đã thêm sản phẩm vào giỏ.')
    else Alert.alert('Lỗi', r.error || 'Không thêm được vào giỏ.')
  }

  const handleProductToAdd = async (
    productId: string | undefined,
    variantId: string | undefined,
    quantity: number
  ) => {
    if (!productId) {
      Alert.alert('Giỏ hàng', 'Thiếu thông tin sản phẩm.')
      return
    }
    setAddingId(productId)
    const r = await addToCart(productId, variantId || undefined, quantity)
    setAddingId(null)
    if (r.success) Alert.alert('Giỏ hàng', 'Đã thêm vào giỏ theo gợi ý của trợ lý.')
    else Alert.alert('Lỗi', r.error || 'Không thêm được.')
  }

  const send = async () => {
    const text = input.trim()
    if (!text || !sessionId || sending) return
    setInput('')
    const userMsg: AssistantUiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    try {
      const res = await aiChatService.sendMessage(sessionId, text)
      const nextSid = res.sessionId || sessionId
      setSessionId(nextSid)
      const fallback =
        (res.products?.length ?? 0) > 0
          ? 'Mình đã tìm thấy sản phẩm phù hợp ở bên dưới.'
          : 'Mình chưa tìm thấy sản phẩm phù hợp. Bạn thử thêm từ khóa ngành hàng, mức giá hoặc thương hiệu nhé.'
      const assistantMsg: AssistantUiMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply?.trim() || fallback,
        products: res.products?.length ? res.products : undefined,
        productToAdd: res.productToAdd ?? undefined,
        cartId: res.cartId,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi tin nhắn thất bại')
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setSending(false)
    }
  }

  const newSession = () => {
    Alert.alert('Cuộc trò chuyện mới', 'Bắt đầu phiên chat mới với trợ lý?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        onPress: async () => {
          setLoadingSession(true)
          try {
            const res = await aiChatService.createNewSession()
            setSessionId(res.sessionId)
            setMessages(
              (res.history || []).map((m) => ({
                id: String(m.id),
                role: m.role as 'user' | 'assistant',
                content: m.content,
                createdAt: m.createdAt,
              }))
            )
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không tạo được phiên mới')
          } finally {
            setLoadingSession(false)
          }
        },
      },
    ])
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Trợ lý mua hàng</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.guest}>
          <Ionicons name="sparkles-outline" size={64} color={COLORS.primary} />
          <Text style={styles.guestTitle}>Đăng nhập để dùng trợ lý AI</Text>
          <Button title="Đăng nhập" onPress={() => router.push('/auth/login')} style={styles.guestBtn} />
        </View>
      </View>
    )
  }

  if (loadingSession && !sessionId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.hint}>Đang kết nối trợ lý…</Text>
      </View>
    )
  }

  const renderProductRow = (products: ProductSuggestion[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.productRow}
    >
      {products.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.productCard}
          onPress={() => openProduct(p.id)}
          activeOpacity={0.85}
        >
          {p.imageUrl ? (
            <Image source={{ uri: p.imageUrl }} style={styles.productImg} />
          ) : (
            <View style={[styles.productImg, styles.productImgPh]}>
              <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
            </View>
          )}
          <Text numberOfLines={2} style={styles.productName}>
            {p.name}
          </Text>
          <Text style={styles.productPrice}>{formatPrice(Number(p.basePrice))}</Text>
          <TouchableOpacity
            style={styles.miniAdd}
            onPress={() => handleAddSuggested(p)}
            disabled={addingId === p.id}
          >
            {addingId === p.id ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <Text style={styles.miniAddText}>Thêm giỏ</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )

  const renderItem = ({ item }: { item: AssistantUiMessage }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.bubbleWrap, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUserBg : styles.bubbleBotBg]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
        </View>
        {!isUser && item.products && item.products.length > 0 && renderProductRow(item.products)}
        {!isUser && item.productToAdd?.productId && (
          <TouchableOpacity
            style={styles.ctaAdd}
            onPress={() =>
              handleProductToAdd(
                item.productToAdd?.productId,
                item.productToAdd?.variantId,
                item.productToAdd?.quantity || 1
              )
            }
            disabled={addingId === item.productToAdd.productId}
          >
            {addingId === item.productToAdd.productId ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <Text style={styles.ctaAddText}>Thêm vào giỏ (theo trợ lý)</Text>
            )}
          </TouchableOpacity>
        )}
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle}>Trợ lý mua hàng</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Luôn sẵn sàng hỗ trợ</Text>
          </View>
        </View>
        <TouchableOpacity onPress={newSession} style={styles.iconBtn}>
          <Ionicons name="add-circle-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyAvatar}>
              <Ionicons name="bag-handle-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>Xin chào! Mình là trợ lý mua hàng.</Text>
            <Text style={styles.emptySub}>
              Mô tả món đồ bạn muốn, mình sẽ gợi ý sản phẩm phù hợp!
            </Text>
            {SUGGESTION_CHIPS.map((label) => (
              <TouchableOpacity
                key={label}
                style={styles.suggestionChip}
                onPress={() => setInput(label)}
                activeOpacity={0.85}
              >
                <Text style={styles.suggestionChipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
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
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    marginTop: SIZES.md,
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
  },
  topBar: {
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
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: SIZES.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
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
  list: {
    flex: 1,
    backgroundColor: COLORS.chatBackground,
  },
  listContent: {
    padding: SIZES.lg,
    paddingBottom: SIZES.xl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.xl,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.chatRowHighlight,
    borderWidth: 1,
    borderColor: COLORS.chatBubbleBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  emptyTitle: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.sm,
    lineHeight: 20,
    marginBottom: SIZES.lg,
  },
  suggestionChip: {
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7ddd2',
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    backgroundColor: COLORS.card,
  },
  suggestionChipText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  bubbleWrap: {
    marginBottom: SIZES.md,
    maxWidth: '92%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
  },
  bubbleBot: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
  },
  bubbleUserBg: {
    backgroundColor: COLORS.primary,
  },
  bubbleBotBg: {
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
  productRow: {
    paddingTop: SIZES.sm,
    gap: SIZES.sm,
  },
  productCard: {
    width: 132,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.chatProductBorder,
    marginRight: SIZES.sm,
  },
  productImg: {
    width: '100%',
    height: 88,
    borderRadius: 8,
    backgroundColor: COLORS.chatBackground,
  },
  productImgPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: FONTS.size.xs,
    color: COLORS.text,
    marginTop: SIZES.xs,
    minHeight: 32,
  },
  productPrice: {
    fontSize: FONTS.size.xs,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  miniAdd: {
    marginTop: SIZES.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  miniAddText: {
    color: COLORS.onPrimary,
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
  ctaAdd: {
    marginTop: SIZES.sm,
    backgroundColor: COLORS.text,
    borderRadius: 10,
    padding: SIZES.md,
    alignItems: 'center',
  },
  ctaAddText: {
    color: COLORS.onPrimary,
    fontWeight: '600',
    fontSize: FONTS.size.sm,
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
  sendBtnDisabled: {
    opacity: 0.5,
  },
})
