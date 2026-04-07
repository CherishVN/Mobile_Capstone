import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth-store'
import { aiChatService } from '@/services/ai-chat-service'
import { productService } from '@/services/product-service'
import { userService } from '@/services/user-service'
import { cartService } from '@/services/cart-service'
import { paymentService } from '@/services/payment-service'
import { orderService } from '@/services/order-service'
import { startVnPayInAppSession } from '@/lib/vnpay-in-app'
import { markPendingPaymentOrder } from '@/lib/pending-payment'
import type { AssistantUiMessage, ProductSuggestion, AiSessionSummary } from '@/types/ai-chat'
import type { Address } from '@/types/user'
import { useCart } from '@/hooks/useCart'
import Button from '@/components/Button'
import SessionListView from '@/components/ai-assistant/SessionListView'
import ConfirmOrderBar, { type AiPaymentMethod } from '@/components/ai-assistant/ConfirmOrderBar'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import {
  readAiChatUiCache,
  writeAiChatUiCache,
  removeAiChatUiCache,
  type ProductSelection,
  type ConfirmTargetCache,
} from '@/utils/ai-chat-ui-cache'

const SUGGESTION_CHIPS = [
  'Áo thun nam dưới 200k',
  'Son môi đỏ đẹp',
  'Laptop gaming tầm 15 triệu',
]

function isOrderRequestText(text: string) {
  return /tạo đơn|đặt đơn|checkout|thanh toán|mua luôn|chốt đơn/i.test(text)
}

function msgId(m: { id: string | number }) {
  return String(m.id)
}

type ConfirmTarget = ConfirmTargetCache

/** Giống FE: tin từ BE (id số) + tin từ cache (id u-/a- có products). */
function mergeCachedMessagesWithBe(
  cachedMessages: AssistantUiMessage[],
  beMessages: AssistantUiMessage[]
): AssistantUiMessage[] {
  if (!cachedMessages.length) return beMessages
  const cachedIds = new Set(cachedMessages.map((m) => msgId(m)))
  const extraFromBe = beMessages.filter((bm) => {
    if (cachedIds.has(msgId(bm))) return false
    const tbm = bm.createdAt ? new Date(bm.createdAt).getTime() : 0
    const dupByContent = cachedMessages.some((cm) => {
      if (cm.role !== bm.role || cm.content !== bm.content) return false
      const tcm = cm.createdAt ? new Date(cm.createdAt).getTime() : 0
      return tcm > 0 && tbm > 0 && Math.abs(tcm - tbm) < 15000
    })
    return !dupByContent
  })
  return [...cachedMessages, ...extraFromBe].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })
}

export default function AssistantScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  const { addToCart, loadCart } = useCart()
  const listRef = useRef<FlatList>(null)

  const [view, setView] = useState<'list' | 'chat'>('list')
  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantUiMessage[]>([])
  const [input, setInput] = useState('')

  const [chatBootLoading, setChatBootLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [applyingBulkId, setApplyingBulkId] = useState<string | null>(null)

  
  const [selectedProductsByMessageId, setSelectedProductsByMessageId] = useState<
    Record<string, Record<string, ProductSelection>>
  >({})
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<AiPaymentMethod>('vnpay')
  const [orderLoading, setOrderLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      
      const res = await aiChatService.listSessions(1, 40)
      if (res.success) setSessions(res.sessions || [])
      else setSessions([])
    } catch {
      setSessions([])
    } finally {
      
      setSessionsLoading(false)
      setSessionsRefreshing(false)
    }
  }, [])

  const onRefreshSessions = () => {
    setSessionsRefreshing(true)
    loadSessions()
  }

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) loadSessions()
    }, [isAuthenticated, loadSessions])
  )

  const loadAddresses = useCallback(async () => {
    try {
      const res = await userService.getAddresses()
      if (res.success && res.data?.length) {
        setAddresses(res.data)
        setSelectedAddressId((prev) => {
          if (prev && res.data!.some((a) => a.id === prev)) return prev
          return res.data!.find((a) => a.isDefault)?.id ?? res.data![0].id
        })
      } else {
        setAddresses([])
        setSelectedAddressId('')
      }
    } catch {
      setAddresses([])
    }
  }, [])

  useEffect(() => {
    
    if (isAuthenticated && confirmTarget) loadAddresses()
  }, [isAuthenticated, confirmTarget, loadAddresses])

  // Giống FE sessionStorage: lưu messages có products + state để vào lại phiên không mất gợi ý SP
  useEffect(() => {
    if (!sessionId) return
    void writeAiChatUiCache(sessionId, {
      messages,
      confirmTarget,
      selectedAddressId,
      selectedProductsByMessageId,
    })
  }, [sessionId, messages, confirmTarget, selectedAddressId, selectedProductsByMessageId])

  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  useEffect(() => {
   
    if (view === 'chat') scrollToEnd()
  }, [messages.length, view])

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
   
    if (r.success) {
      await loadCart()
      Alert.alert('Giỏ hàng', 'Đã thêm sản phẩm vào giỏ.')
    } else Alert.alert('Lỗi', r.error || 'Không thêm được vào giỏ.')
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
    
    if (r.success) {
      await loadCart()
      Alert.alert('Giỏ hàng', 'Đã thêm vào giỏ theo gợi ý của trợ lý.')
    } else Alert.alert('Lỗi', r.error || 'Không thêm được.')
  }

  const buildConfirmFromCart = async (messageId: string, preferredProductId?: string) => {
    try {
      const cartRes = await cartService.getMyCart()
      const cart = cartRes.success ? cartRes.data : null
      if (!cart?.id || !cart.items?.length) return false
      const matched = preferredProductId
        ? cart.items.find((i) => i.productId === preferredProductId)
        : cart.items[0]
      if (!matched) return false
      setConfirmTarget({ cartId: cart.id, messageId })
      return true
    } catch {
      return false
    }
  }

  const getSelectedProducts = (messageId: string | number, products: ProductSuggestion[]) => {
    const selections = selectedProductsByMessageId[String(messageId)] ?? {}
    return products
      .map((p) => {
        const sel = selections[p.id]
        if (!sel?.checked) return null
        return { ...p, quantity: Math.max(1, Number(sel.quantity) || 1) }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }

  const handleApplySelectedProducts = async (msg: AssistantUiMessage) => {
    const products = msg.products ?? []
    if (!products.length) return
    const selectedItems = getSelectedProducts(msg.id, products)
    if (!selectedItems.length) {
      Alert.alert('Giỏ hàng', 'Hãy chọn ít nhất 1 sản phẩm trước khi bấm thêm.')
      return
    }
    setApplyingBulkId(msgId(msg))
    try {
      for (const item of selectedItems) {
        const vid = item.variants?.[0]?.id
        await cartService.addItem({
          productId: item.id,
          variantId: vid,
          quantity: item.quantity,
        })
      }
      await loadCart()
      const cartRes = await cartService.getMyCart()
      const cart = cartRes.success ? cartRes.data : null
      const first = selectedItems[0]
      const confirmMsgId = `a-bulk-confirm-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: confirmMsgId,
          role: 'assistant',
          content:
            selectedItems.length === 1
              ? `Mình đã thêm ${first.quantity} × "${first.name}" vào giỏ. Bạn có muốn tạo đơn ngay không?`
              : `Mình đã thêm ${selectedItems.length} sản phẩm bạn chọn vào giỏ. Bạn có muốn tạo đơn ngay không?`,
          createdAt: new Date().toISOString(),
        },
      ])
      if (cart?.id) setConfirmTarget({ cartId: cart.id, messageId: confirmMsgId })
      Alert.alert('Giỏ hàng', 'Đã thêm sản phẩm đã chọn vào giỏ.')
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thêm được vào giỏ.')
    } finally {
      setApplyingBulkId(null)
    }
  }

  const toggleProductSelection = (messageId: string | number, productId: string) => {
    const key = String(messageId)
    setSelectedProductsByMessageId((prev) => {
      const mm = { ...(prev[key] ?? {}) }
      const cur = mm[productId] ?? { checked: false, quantity: 1 }
      mm[productId] = { ...cur, checked: !cur.checked }
      return { ...prev, [key]: mm }
    })
  }

  const setProductQty = (messageId: string | number, productId: string, qty: number) => {
    const key = String(messageId)
    const q = Math.max(1, Math.min(99, qty))
    setSelectedProductsByMessageId((prev) => {
      const mm = { ...(prev[key] ?? {}) }
      const cur = mm[productId] ?? { checked: false, quantity: 1 }
      mm[productId] = { ...cur, quantity: q }
      return { ...prev, [key]: mm }
    })
  }

  const send = async () => {
    const text = input.trim()
    if (!text || !sessionId || sending) return
    setInput('')
    const userMsg: AssistantUiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        products: res.products?.length ? res.products : undefined,
        productToAdd: res.productToAdd ?? undefined,
        cartId: res.cartId,
        sendResponse: { ...res, cartId: res.cartId },
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (res.products?.length) {
        const aid = msgId(assistantMsg)
        setSelectedProductsByMessageId((prev) => {
          const nextMap = res.products!.reduce<Record<string, ProductSelection>>((acc, p) => {
            const old = prev[aid]?.[p.id]
            acc[p.id] = { checked: old?.checked ?? false, quantity: old?.quantity ?? 1 }
            return acc
          }, {})
          return { ...prev, [aid]: nextMap }
        })
      }

      const shouldConfirm =
        (res.needsConfirmation && res.intent === 'checkout') ||
        res.intent === 'checkout' ||
        isOrderRequestText(text) ||
        /bạn có muốn.*tạo đơn|xác nhận.*đơn|tạo đơn hàng/i.test(res.reply || '')

      if (shouldConfirm) {
        if (res.cartId) {
          setConfirmTarget({ cartId: res.cartId, messageId: msgId(assistantMsg) })
        } else {
          const ok = await buildConfirmFromCart(msgId(assistantMsg))
          if (!ok && isOrderRequestText(text)) {
            Alert.alert('Giỏ hàng', 'Chưa có sản phẩm trong giỏ để tạo đơn.')
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi tin nhắn thất bại')
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setSending(false)
    }
  }

  
  const handleConfirmOrder = async () => {
    if (!sessionId) {
      Alert.alert('Trợ lý', 'Phiên chưa sẵn sàng.')
      return
    }
    setOrderLoading(true)
    try {
      const latestRes = await userService.getAddresses()
      const latest = latestRes.success && latestRes.data ? latestRes.data : addresses
      if (latest.length) setAddresses(latest)

      const resolved =
        latest.find((a) => a.id === selectedAddressId) ??
        latest.find((a) => a.isDefault) ??
        latest[0]

      if (!resolved) {
        Alert.alert('Địa chỉ', 'Bạn chưa có địa chỉ giao hàng. Thêm trong Hồ sơ → Địa chỉ.')
        return
      }
      if (resolved.id !== selectedAddressId) setSelectedAddressId(resolved.id)

      let cartId = confirmTarget?.cartId
      if (!cartId) {
        const c = await cartService.getMyCart()
        cartId = c.success ? c.data?.id : undefined
      }
      if (!cartId) {
        Alert.alert('Giỏ hàng', 'Giỏ đang trống.')
        return
      }

      const res = await aiChatService.confirmOrder(sessionId, cartId, resolved.id)

      if (res.success && res.orderId) {
        if (paymentMethod === 'vnpay') {
          await markPendingPaymentOrder(res.orderId)
          const vn = await startVnPayInAppSession(res.orderId)
          if (vn.kind === 'error') {
            await orderService.cancelPendingOrder(res.orderId).catch(() => null)
            Alert.alert(
              'Thanh toán',
              vn.message ||
                'Không khởi tạo được thanh toán. Đơn chờ thanh toán đã được hủy. Vui lòng thử lại.'
            )
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `a-pay-${Date.now()}`,
                role: 'assistant',
                content:
                  'Đơn đã tạo. Hoàn tất thanh toán VNPay trong màn hình tiếp theo (trong app).',
                createdAt: new Date().toISOString(),
              },
            ])
            setConfirmTarget(null)
          }
        } else {
          const payRes = await paymentService.createMoMo(res.orderId).catch(() => null)
          if (payRes?.success && payRes.paymentUrl) {
            await markPendingPaymentOrder(res.orderId)
            setMessages((prev) => [
              ...prev,
              {
                id: `a-pay-${Date.now()}`,
                role: 'assistant',
                content: 'Đơn đã tạo. Mở MoMo để thanh toán.',
                createdAt: new Date().toISOString(),
              },
            ])
            setConfirmTarget(null)
            const can = await Linking.canOpenURL(payRes.paymentUrl)
            if (can) await Linking.openURL(payRes.paymentUrl)
            else Alert.alert('Thanh toán', 'Không mở được liên kết thanh toán.')
          } else {
            await orderService.cancelPendingOrder(res.orderId).catch(() => null)
            Alert.alert(
              'Thanh toán',
              'Không khởi tạo được thanh toán. Đơn chờ thanh toán đã được hủy. Vui lòng thử lại.'
            )
          }
        }
      } else if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-ok-${Date.now()}`,
            role: 'assistant',
            content: res.message,
            createdAt: new Date().toISOString(),
          },
        ])
        setConfirmTarget(null)
        Alert.alert('Đơn hàng', res.message)
      } else {
        Alert.alert('Đơn hàng', res.message || 'Không tạo được đơn.')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không xác nhận được đơn hàng.')
    } finally {
      setOrderLoading(false)
    }
  }

  const rejectConfirmOrder = async () => {
    setConfirmTarget(null)
    if (!sessionId) return
    try {
      const res = await aiChatService.sendMessage(sessionId, 'Tôi không muốn tạo đơn hàng lúc này')
      setMessages((prev) => [
        ...prev,
        {
          id: `u-rej-${Date.now()}`,
          role: 'user',
          content: 'Tôi không muốn tạo đơn hàng lúc này',
          createdAt: new Date().toISOString(),
        },
        {
          id: `a-rej-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          createdAt: new Date().toISOString(),
        },
      ])
    } catch {
      /* ignore */
    }
  }

  const startNewChat = async () => {
    const prevSessionId = sessionId
    setChatBootLoading(true)
    try {
      if (prevSessionId) await removeAiChatUiCache(prevSessionId)
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
      setSelectedProductsByMessageId({})
      setConfirmTarget(null)
      setView('chat')
      loadSessions()
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tạo được phiên mới')
    } finally {
      setChatBootLoading(false)
    }
  }

  const openSession = async (sid: string) => {
    setChatBootLoading(true)
    try {
      await aiChatService.markSessionRead(sid).catch(() => null)
      const res = await aiChatService.getSessionMessages(sid)
      if (!res.success) throw new Error('Không tải được tin nhắn')
      const beMessages: AssistantUiMessage[] = (res.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
      const cached = await readAiChatUiCache(sid)
      const merged =
        cached?.messages?.length && cached.messages.length > 0
          ? mergeCachedMessagesWithBe(cached.messages, beMessages)
          : beMessages

      setSessionId(sid)
      setMessages(merged)
      setSelectedProductsByMessageId({})
      setConfirmTarget(null)
      setView('chat')
      loadSessions()
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không mở được phiên chat')
    } finally {
      setChatBootLoading(false)
    }
  }

  const newSessionFromChat = () => {
    Alert.alert('Cuộc trò chuyện mới', 'Bắt đầu phiên chat mới với trợ lý?', [
      { text: 'Hủy', style: 'cancel' },
      
      { text: 'Đồng ý', onPress: () => startNewChat() },
    ])
  }

  const onMarkRead = async (sid: string) => {
    try {
      await aiChatService.markSessionRead(sid)
      loadSessions()
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không cập nhật được')
    }
  }

  const onToggleMute = async (sid: string, next: boolean) => {
    try {
      await aiChatService.setSessionMuted(sid, next)
      loadSessions()
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không cập nhật được')
    }
  }

  const onDeleteSession = async (sid: string) => {
    try {
      await aiChatService.deleteSession(sid)
      await removeAiChatUiCache(sid)
      if (sessionId === sid) {
        setView('list')
        setSessionId(null)
        setMessages([])
      }
      loadSessions()
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không xóa được')
    }
  }

  const backToList = () => {
    setView('list')
    loadSessions()
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

  
  if (view === 'list') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topTitle}>Trợ lý mua hàng</Text>
          </View>
          <TouchableOpacity onPress={startNewChat} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <SessionListView
          sessions={sessions}
          loading={sessionsLoading}
          refreshing={sessionsRefreshing}
          onRefresh={onRefreshSessions}
          onOpenSession={openSession}
          onNewChat={startNewChat}
          onMarkRead={onMarkRead}
          onToggleMute={onToggleMute}
          onDelete={onDeleteSession}
        />
      </View>
    )
  }

  if (chatBootLoading && messages.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        
        <Text style={styles.hint}>Đang mở phiên chat…</Text>
      </View>
    )
  }

  
  const renderProductBlocks = (msg: AssistantUiMessage, products: ProductSuggestion[]) => {
    const formatProductPrice = (n: number) =>
      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
    const sel = selectedProductsByMessageId[msgId(msg)] ?? {}
    return (
      <View style={styles.productBlocks}>
        {products.map((p) => {
          const s = sel[p.id] ?? { checked: false, quantity: 1 }
          return (
            <View key={p.id} style={[styles.productRowCard, s.checked && styles.productRowCardOn]}>
              <TouchableOpacity
                style={styles.cbTouch}
                onPress={() => toggleProductSelection(msgId(msg), p.id)}
              >
                <Ionicons
                  name={s.checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={s.checked ? COLORS.primary : COLORS.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.productRowMid} onPress={() => openProduct(p.id)}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={styles.productRowImg} />
                ) : (
                  <View style={[styles.productRowImg, styles.productRowImgPh]}>
                    <Ionicons name="image-outline" size={22} color={COLORS.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productRowName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.productRowPrice}>{formatProductPrice(Number(p.basePrice))}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  onPress={() => setProductQty(msgId(msg), p.id, s.quantity - 1)}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="remove" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{s.quantity}</Text>
                <TouchableOpacity
                  onPress={() => setProductQty(msgId(msg), p.id, s.quantity + 1)}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="add" size={18} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
        <TouchableOpacity
          
          style={styles.bulkAddBtn}
          onPress={() => handleApplySelectedProducts(msg)}
          disabled={applyingBulkId === msgId(msg)}
        >
          
          {applyingBulkId === msgId(msg) ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            
            <Text style={styles.bulkAddText}>Thêm đã chọn vào giỏ</Text>
          )}
          
        </TouchableOpacity>
      
      </View>
    )
  }

  const renderItem = ({ item }: { item: AssistantUiMessage }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.bubbleWrap, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUserBg : styles.bubbleBotBg]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
        </View>
        
        {!isUser && item.products && item.products.length > 0 && renderProductBlocks(item, item.products)}
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
        
        <TouchableOpacity onPress={backToList} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle}>Trợ lý mua hàng</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Luôn sẵn sàng hỗ trợ</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={newSessionFromChat} style={styles.iconBtn}>
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

      <ConfirmOrderBar
        visible={!!confirmTarget && !!sessionId}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={setSelectedAddressId}
        paymentMethod={paymentMethod}
        onPaymentMethod={setPaymentMethod}
        onConfirm={handleConfirmOrder}
        onCancel={rejectConfirmOrder}
        onOpenAddresses={() => router.push('/profile/addresses')}
        loading={orderLoading}
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
    
    maxWidth: '100%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    maxWidth: '96%',
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
 
  productBlocks: {
    marginTop: SIZES.sm,
    gap: SIZES.sm,
  },
  
  productRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    padding: SIZES.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.chatProductBorder,
    
    backgroundColor: COLORS.card,
  },
  productRowCardOn: {
    borderColor: '#f3c97b',
    backgroundColor: COLORS.chatRowHighlight,
  },
  
  cbTouch: { padding: 4 },
  productRowMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  productRowImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.chatBackground,
  },
  
  productRowImgPh: { justifyContent: 'center', alignItems: 'center' },
  productRowName: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  productRowPrice: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  
  qtyVal: { minWidth: 22, textAlign: 'center', fontWeight: '700', fontSize: FONTS.size.sm },
  bulkAddBtn: {
    marginTop: SIZES.sm,
    backgroundColor: COLORS.primary,
    
    borderRadius: 12,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  
  bulkAddText: { color: COLORS.onPrimary, fontWeight: '800', fontSize: FONTS.size.sm },
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