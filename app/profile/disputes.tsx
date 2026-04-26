import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { disputeService } from '@/services/dispute-service'
import { orderService } from '@/services/order-service'
import {
  DisputeStatus,
  DisputeStatusLabels,
  DisputeStatusColors,
  DisputeType,
  DisputeTypeLabels,
  CANCELLABLE_DISPUTE_STATUSES,
  type CustomerDispute,
} from '@/types/dispute'
import type { Order } from '@/types/order'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const PAGE_SIZE = 10

const STATUS_FILTERS = [
  { value: -1, label: 'Tất cả' },
  { value: DisputeStatus.Pending, label: 'Chờ xử lý' },
  { value: DisputeStatus.UnderReview, label: 'Đang xem xét' },
  { value: DisputeStatus.WaitingCustomer, label: 'Chờ bạn' },
  { value: DisputeStatus.WaitingSeller, label: 'Chờ seller' },
  { value: DisputeStatus.Resolved, label: 'Đã giải quyết' },
  { value: DisputeStatus.Refunded, label: 'Đã hoàn tiền' },
  { value: DisputeStatus.Rejected, label: 'Từ chối' },
  { value: DisputeStatus.Cancelled, label: 'Đã hủy' },
]

/** Khớp FE purchase/[id] — «Không nhận được» chỉ từ nút riêng, không nằm trong danh sách chung. */
const DISPUTE_TYPE_OPTIONS = [
  { value: DisputeType.Refund, label: 'Hoàn tiền' },
  { value: DisputeType.Return, label: 'Trả hàng' },
  { value: DisputeType.Damaged, label: 'Hàng hư hỏng' },
  { value: DisputeType.WrongItem, label: 'Sai hàng' },
  { value: DisputeType.QualityIssue, label: 'Chất lượng không đảm bảo' },
  { value: DisputeType.Other, label: 'Khác' },
] as const

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// --- Evidence uploader for mobile ---
interface EvidenceUploaderProps {
  urls: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}

function EvidencePicker({ urls, onChange, disabled }: EvidenceUploaderProps) {
  const [uploading, setUploading] = useState(false)

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - urls.length,
    })
    if (result.canceled || !result.assets.length) return

    setUploading(true)
    const newUrls: string[] = []
    for (const asset of result.assets) {
      try {
        const ext = asset.uri.split('.').pop() ?? 'jpg'
        const path = `dispute-evidence/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const response = await fetch(asset.uri)
        const blob = await response.blob()
        const { error } = await supabase.storage
          .from('product-images')
          .upload(path, blob, { contentType: asset.mimeType ?? 'image/jpeg' })
        if (!error) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(path)
          newUrls.push(data.publicUrl)
        }
      } catch {
        // bỏ qua file lỗi
      }
    }
    setUploading(false)
    if (newUrls.length) onChange([...urls, ...newUrls])
  }

  const remove = (idx: number) => {
    onChange(urls.filter((_, i) => i !== idx))
  }

  return (
    <View style={epStyles.wrap}>
      {urls.map((u, i) => (
        <View key={i} style={epStyles.chip}>
          <Ionicons name="image-outline" size={14} color={COLORS.primary} />
          <Text style={epStyles.chipText} numberOfLines={1}>Ảnh {i + 1}</Text>
          {!disabled && (
            <TouchableOpacity onPress={() => remove(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {urls.length < 10 && !disabled && (
        <TouchableOpacity
          style={[epStyles.addBtn, uploading && epStyles.addBtnDisabled]}
          onPress={pick}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
              <Text style={epStyles.addBtnText}>Thêm ảnh/video</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const epStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    maxWidth: 120,
  },
  chipText: { fontSize: 12, color: COLORS.primary, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
})

// --- Main Screen ---
export default function DisputesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ orderId?: string; defaultType?: string }>()
  const [disputes, setDisputes] = useState<CustomerDispute[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(-1)
  const [loadingMore, setLoadingMore] = useState(false)

  // Create modal
  const [createVisible, setCreateVisible] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{
    orderId: string
    type: number
    title: string
    reason: string
    requestedAmount: string
  }>({
    orderId: '',
    type: DisputeType.Refund,
    title: '',
    reason: '',
    requestedAmount: '',
  })
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [typePickerVisible, setTypePickerVisible] = useState(false)
  const [hintOrderTotal, setHintOrderTotal] = useState<number | null>(null)
  /** true = mở từ «Báo không nhận được hàng» — không cho đổi sang Hoàn tiền / Trả hàng /... */
  const [lockTypeToNotReceived, setLockTypeToNotReceived] = useState(false)
  /** Đơn đã load — chọn SL khiếu nại từng dòng (khớp FE). */
  const [orderSnapshot, setOrderSnapshot] = useState<Order | null>(null)
  const [disputeLineQty, setDisputeLineQty] = useState<Record<string, number>>({})

  const disputeSelectedGoodsValue = useMemo(() => {
    if (!orderSnapshot) return 0
    let sum = 0
    for (const it of orderSnapshot.items) {
      const q = Math.min(
        Math.max(0, Math.floor(disputeLineQty[it.id] ?? 0)),
        it.quantity,
      )
      sum += it.unitPrice * q
    }
    return sum
  }, [orderSnapshot, disputeLineQty])

  // Auto-open create form khi navigate từ trang đơn hàng (defaultType=notReceived → loại khiếu nại tương ứng)
  useEffect(() => {
    if (params.orderId) {
      const fromNotReceived = params.defaultType === 'notReceived'
      setForm(f => ({
        ...f,
        orderId: params.orderId!,
        ...(fromNotReceived ? { type: DisputeType.NotReceived } : {}),
      }))
      setEvidenceUrls([])
      setLockTypeToNotReceived(fromNotReceived)
      setCreateVisible(true)
    }
  }, [params.orderId, params.defaultType])

  useEffect(() => {
    if (!createVisible) {
      setHintOrderTotal(null)
      setOrderSnapshot(null)
      setDisputeLineQty({})
      return
    }
    const id = form.orderId.trim()
    if (!id) {
      setHintOrderTotal(null)
      setOrderSnapshot(null)
      setDisputeLineQty({})
      return
    }
    let alive = true
    const t = setTimeout(() => {
      void orderService.getOrderById(id).then(res => {
        if (!alive) return
        if (res.success && res.order) {
          const o = res.order
          setHintOrderTotal(o.total)
          setOrderSnapshot(o)
          const init: Record<string, number> = {}
          for (const it of o.items) init[it.id] = 0
          setDisputeLineQty(init)
        } else {
          setHintOrderTotal(null)
          setOrderSnapshot(null)
          setDisputeLineQty({})
        }
      })
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [createVisible, form.orderId])

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<CustomerDispute | null>(null)
  const [canceling, setCanceling] = useState(false)

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const params: any = { page: pageNum, pageSize: PAGE_SIZE }
      if (statusFilter !== -1) params.status = statusFilter
      const res = await disputeService.getMyDisputes(params)
      if (res.success) {
        setDisputes(prev => append ? [...prev, ...res.disputes] : res.disputes)
        setTotal(res.totalCount)
        setPage(pageNum)
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể tải danh sách khiếu nại')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    setDisputes([])
    load(1)
  }, [statusFilter])

  const onRefresh = () => {
    setRefreshing(true)
    load(1)
  }

  const loadMore = () => {
    const totalPages = Math.ceil(total / PAGE_SIZE)
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)
    load(page + 1, true)
  }

  const resetForm = () => {
    setForm({ orderId: '', type: DisputeType.Refund, title: '', reason: '', requestedAmount: '' })
    setEvidenceUrls([])
    setLockTypeToNotReceived(false)
    setOrderSnapshot(null)
    setDisputeLineQty({})
  }

  const closeCreateModal = () => {
    setCreateVisible(false)
    setTypePickerVisible(false)
    setLockTypeToNotReceived(false)
  }

  const applyDisputeAmountFromSelection = () => {
    if (disputeSelectedGoodsValue <= 0) {
      Alert.alert('Lỗi', 'Chọn ít nhất một sản phẩm với số lượng khiếu nại trước.')
      return
    }
    setForm(f => ({ ...f, requestedAmount: String(Math.round(disputeSelectedGoodsValue)) }))
  }

  const handleCreate = async () => {
    if (!form.orderId.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập mã đơn hàng'); return }
    if (!form.title.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề'); return }
    if (form.reason.trim().length < 20) {
      Alert.alert('Lỗi', `Lý do phải có ít nhất 20 ký tự (hiện: ${form.reason.trim().length})`)
      return
    }

    const ordRes = await orderService.getOrderById(form.orderId.trim())
    if (!ordRes.success || !ordRes.order) {
      Alert.alert('Lỗi', ordRes.message ?? 'Không tìm thấy đơn hàng')
      return
    }
    const order = ordRes.order
    const items = order.items
      .map((it) => ({
        orderItemId: it.id,
        quantity: Math.min(
          Math.max(0, Math.floor(disputeLineQty[it.id] ?? 0)),
          it.quantity,
        ),
      }))
      .filter((x) => x.quantity > 0)

    if (items.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một sản phẩm và nhập số lượng khiếu nại.')
      return
    }

    let maxSelected = 0
    for (const line of items) {
      const it = order.items.find((i) => i.id === line.orderItemId)
      if (it) maxSelected += it.unitPrice * line.quantity
    }

    const maxTotal = order.total
    const rawAmt = form.requestedAmount.trim()
    const reqAmt = rawAmt === '' ? 0 : Number(rawAmt)
    if (Number.isNaN(reqAmt) || reqAmt < 0) {
      Alert.alert('Lỗi', 'Số tiền yêu cầu không hợp lệ')
      return
    }
    if (reqAmt > maxTotal) {
      Alert.alert('Lỗi', `Số tiền yêu cầu không được vượt quá tổng đơn (${formatPrice(maxTotal)})`)
      return
    }
    if (reqAmt > maxSelected + 0.01) {
      Alert.alert(
        'Lỗi',
        `Số tiền yêu cầu không được vượt quá giá trị các sản phẩm đã chọn (${formatPrice(maxSelected)}).`,
      )
      return
    }
    const submitType = lockTypeToNotReceived ? DisputeType.NotReceived : form.type
    if (submitType === DisputeType.Refund && reqAmt <= 0) {
      Alert.alert('Lỗi', 'Với loại hoàn tiền, vui lòng nhập số tiền lớn hơn 0')
      return
    }

    setCreating(true)
    try {
      const res = await disputeService.createDispute({
        orderId: form.orderId.trim(),
        type: submitType,
        title: form.title.trim(),
        reason: form.reason.trim(),
        requestedAmount: reqAmt,
        items,
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      })
      if (res.success) {
        Alert.alert('Thành công', 'Đã tạo khiếu nại')
        closeCreateModal()
        resetForm()
        load(1)
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không tạo được khiếu nại')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không tạo được khiếu nại')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCanceling(true)
    try {
      const res = await disputeService.cancelDispute(cancelTarget.id)
      if (res.success) {
        Alert.alert('Thành công', 'Đã hủy khiếu nại')
        setCancelTarget(null)
        load(1)
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không hủy được')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không hủy được')
    } finally {
      setCanceling(false)
    }
  }

  const renderItem = ({ item: d }: { item: CustomerDispute }) => {
    const statusColor = DisputeStatusColors[d.status] ?? '#9ca3af'
    const canCancel = CANCELLABLE_DISPUTE_STATUSES.has(d.status)
    const isWaiting = d.status === DisputeStatus.WaitingCustomer

    return (
      <TouchableOpacity
        style={[styles.card, isWaiting && styles.cardHighlight]}
        onPress={() => router.push(`/disputes/${d.id}` as any)}
        activeOpacity={0.7}
      >
        {isWaiting && (
          <View style={styles.waitingBanner}>
            <Ionicons name="alert-circle" size={14} color="#6366f1" />
            <Text style={styles.waitingBannerText}>Admin đang chờ phản hồi từ bạn</Text>
          </View>
        )}
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge]}>
              <Text style={styles.typeBadgeText}>{DisputeTypeLabels[d.type] ?? d.typeName}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {DisputeStatusLabels[d.status] ?? d.statusName}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </View>

        <Text style={styles.disputeTitle} numberOfLines={1}>{d.title}</Text>
        <Text style={styles.disputeReason} numberOfLines={2}>{d.reason}</Text>

        <View style={styles.cardMeta}>
          <Text style={styles.metaShop} numberOfLines={1}>{d.shopName}</Text>
          <Text style={styles.metaAmount}>{formatPrice(d.requestedAmount)}</Text>
          <Text style={styles.metaDate}>{formatDate(d.createdAt)}</Text>
        </View>

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={(e) => {
              e.stopPropagation?.()
              setCancelTarget(d)
            }}
          >
            <Ionicons name="close-circle-outline" size={14} color={COLORS.error} />
            <Text style={styles.cancelBtnText}>Hủy khiếu nại</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Khiếu nại của tôi</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => { resetForm(); setCreateVisible(true) }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={d => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={60} color={COLORS.border} />
              <Text style={styles.emptyTitle}>Chưa có khiếu nại nào</Text>
              <Text style={styles.emptySub}>
                {statusFilter !== -1 ? 'Không tìm thấy khiếu nại với bộ lọc này' : 'Nhấn dấu + để tạo khiếu nại mới'}
              </Text>
            </View>
          }
        />
      )}

      {/* === Create Dispute Modal === */}
      <Modal
        visible={createVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          closeCreateModal()
          resetForm()
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Tạo khiếu nại mới{orderSnapshot?.orderCode ? ` #${orderSnapshot.orderCode}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  closeCreateModal()
                  resetForm()
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.disputeFormDesc}>
              Mỗi đơn hàng chỉ được khiếu nại một lần. Chọn đúng sản phẩm và số lượng bị ảnh hưởng — bằng chứng rõ
              ràng.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Order ID */}
              <View style={styles.field}>
                <Text style={styles.label}>Mã đơn hàng <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  placeholderTextColor={COLORS.placeholder}
                  value={form.orderId}
                  onChangeText={v => setForm(f => ({ ...f, orderId: v }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {orderSnapshot && orderSnapshot.items.length > 0 ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Sản phẩm trong phạm vi khiếu nại <Text style={styles.required}>*</Text></Text>
                  <Text style={styles.hintSub}>
                    Nhập số lượng khiếu nại từng món (0 = không chọn). Ví dụ chỉ 1 món hư: nhập 1 ở dòng đó, các món
                    khác để 0.
                  </Text>
                  <View style={styles.lineList}>
                    {orderSnapshot.items.map(it => (
                      <View key={it.id} style={styles.lineRow}>
                        <View style={styles.lineThumb}>
                          {it.productImage ? (
                            <Image source={{ uri: it.productImage }} style={styles.lineThumbImg} />
                          ) : (
                            <View style={styles.lineThumbPlaceholder}>
                              <Ionicons name="cube-outline" size={22} color={COLORS.textSecondary} />
                            </View>
                          )}
                        </View>
                        <View style={styles.lineInfo}>
                          <Text numberOfLines={2} style={styles.lineName}>
                            {it.productName}
                          </Text>
                          <Text style={styles.lineMeta}>
                            {formatPrice(it.unitPrice)} / món · tối đa {it.quantity}
                          </Text>
                        </View>
                        <TextInput
                          style={styles.qtyInput}
                          keyboardType="number-pad"
                          value={String(disputeLineQty[it.id] ?? 0)}
                          onChangeText={t => {
                            const raw = parseInt(t.replace(/\D/g, ''), 10)
                            const v = Number.isNaN(raw) ? 0 : Math.min(it.quantity, Math.max(0, raw))
                            setDisputeLineQty(prev => ({ ...prev, [it.id]: v }))
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Type picker (khóa nếu mở từ «Báo không nhận được hàng») */}
              <View style={styles.field}>
                <Text style={styles.label}>Loại khiếu nại <Text style={styles.required}>*</Text></Text>
                {lockTypeToNotReceived ? (
                  <View style={[styles.selector, styles.selectorLocked]}>
                    <Text style={styles.selectorText}>{DisputeTypeLabels[DisputeType.NotReceived]}</Text>
                    <Ionicons name="lock-closed" size={16} color={COLORS.textSecondary} />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.selector}
                    onPress={() => setTypePickerVisible(true)}
                  >
                    <Text style={styles.selectorText}>{DisputeTypeLabels[form.type]}</Text>
                    <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
                {lockTypeToNotReceived ? (
                  <Text style={styles.lockedTypeHint}>
                    Bạn mở từ «Báo không nhận được hàng» trên đơn — loại này đã cố định, không đổi sang loại
                    khác.
                  </Text>
                ) : null}
              </View>

              {/* Title */}
              <View style={styles.field}>
                <Text style={styles.label}>Tiêu đề <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: Sản phẩm bị hỏng khi nhận hàng"
                  placeholderTextColor={COLORS.placeholder}
                  value={form.title}
                  onChangeText={v => setForm(f => ({ ...f, title: v }))}
                  maxLength={255}
                />
              </View>

              {/* Reason */}
              <View style={styles.field}>
                <Text style={styles.label}>Lý do chi tiết <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="Mô tả rõ tình trạng sản phẩm, thời điểm phát hiện vấn đề... (tối thiểu 20 ký tự)"
                  placeholderTextColor={COLORS.placeholder}
                  value={form.reason}
                  onChangeText={v => setForm(f => ({ ...f, reason: v }))}
                  multiline
                  numberOfLines={4}
                  maxLength={2000}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, form.reason.length < 20 && form.reason.length > 0 && { color: COLORS.error }]}>
                  {form.reason.length}/2000{form.reason.length > 0 && form.reason.length < 20 ? ` (còn thiếu ${20 - form.reason.length})` : ''}
                </Text>
              </View>

              {/* Evidence */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Bằng chứng <Text style={styles.optional}>(ảnh / video, tối đa 10)</Text>
                </Text>
                <EvidencePicker urls={evidenceUrls} onChange={setEvidenceUrls} disabled={creating} />
              </View>

              {/* Amount */}
              <View style={styles.field}>
                <View style={styles.amountLabelRow}>
                  <Text style={styles.label}>
                    Số tiền yêu cầu hoàn (₫) <Text style={styles.optional}>(bỏ trống nếu không đòi hoàn)</Text>
                  </Text>
                  {disputeSelectedGoodsValue > 0 ? (
                    <TouchableOpacity
                      style={styles.fillAmountBtn}
                      onPress={applyDisputeAmountFromSelection}
                      disabled={creating}
                    >
                      <Text style={styles.fillAmountBtnText}>
                        Điền theo phần hàng ({formatPrice(disputeSelectedGoodsValue)})
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  value={form.requestedAmount}
                  onChangeText={v => setForm(f => ({ ...f, requestedAmount: v }))}
                  keyboardType="numeric"
                />
                <Text style={styles.charCount}>
                  Giá trị phần hàng đã chọn:{' '}
                  {disputeSelectedGoodsValue > 0 ? formatPrice(disputeSelectedGoodsValue) : '—'}
                  {disputeSelectedGoodsValue > 0
                    ? ' (ví dụ chỉ 1 món hư → tối đa yêu cầu hoàn bằng giá món đó).'
                    : ''}
                </Text>
                {hintOrderTotal != null && (
                  <Text style={styles.charCount}>
                    Trần tổng đơn: {formatPrice(hintOrderTotal)}. Loại Hoàn tiền: bắt buộc nhập &gt; 0.
                  </Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => {
                    closeCreateModal()
                    resetForm()
                  }}
                  disabled={creating}
                >
                  <Text style={styles.btnOutlineText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, creating && styles.btnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnPrimaryText}>Tạo khiếu nại</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Type picker modal */}
      <Modal
        visible={typePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          onPress={() => setTypePickerVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>Chọn loại khiếu nại</Text>
            {DISPUTE_TYPE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pickerItem, form.type === opt.value && styles.pickerItemActive]}
                onPress={() => {
                  setForm(f => {
                    const next = { ...f, type: opt.value }
                    if (opt.value === DisputeType.Refund && orderSnapshot) {
                      let sum = 0
                      for (const it of orderSnapshot.items) {
                        const q = Math.min(
                          Math.max(0, Math.floor(disputeLineQty[it.id] ?? 0)),
                          it.quantity,
                        )
                        sum += it.unitPrice * q
                      }
                      if (sum > 0) next.requestedAmount = String(Math.round(sum))
                    }
                    return next
                  })
                  setTypePickerVisible(false)
                }}
              >
                <Text style={[styles.pickerItemText, form.type === opt.value && styles.pickerItemTextActive]}>
                  {opt.label}
                </Text>
                {form.type === opt.value && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cancel confirm */}
      <Modal
        visible={cancelTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Hủy khiếu nại</Text>
            <Text style={styles.confirmMsg}>
              Bạn có chắc muốn hủy khiếu nại &ldquo;{cancelTarget?.title}&rdquo;? Hành động này không thể hoàn tác.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setCancelTarget(null)} disabled={canceling}>
                <Text style={styles.btnOutlineText}>Không</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnDestructive, canceling && styles.btnDisabled]}
                onPress={handleCancel}
                disabled={canceling}
              >
                {canceling
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Xác nhận hủy</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg, paddingTop: SIZES.xxl + 10, paddingBottom: SIZES.md,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SIZES.xs },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  createBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterBar: { maxHeight: 50, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterContent: { paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  filterChipText: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.primary, fontWeight: '600' },

  listContent: { padding: SIZES.md, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.text },
  emptySub: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SIZES.xl },

  card: {
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: SIZES.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHighlight: { borderColor: '#818cf8', backgroundColor: '#eef2ff' },
  waitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e0e7ff', borderRadius: 8, padding: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  waitingBannerText: { fontSize: FONTS.size.xs, color: '#4338ca', fontWeight: '500', flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.xs },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  typeBadgeText: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusBadgeText: { fontSize: FONTS.size.xs, fontWeight: '600' },
  disputeTitle: { fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  disputeReason: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SIZES.sm },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaShop: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, flex: 1 },
  metaAmount: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '600' },
  metaDate: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SIZES.sm, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cancelBtnText: { fontSize: FONTS.size.xs, color: COLORS.error, fontWeight: '500' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SIZES.lg, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.sm },
  modalTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text, flex: 1, paddingRight: 8 },
  disputeFormDesc: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SIZES.md,
    paddingHorizontal: 2,
  },
  field: { marginBottom: SIZES.md },
  hintSub: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 16 },
  lineList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    maxHeight: 220,
    backgroundColor: COLORS.background,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lineThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  lineThumbImg: { width: 48, height: 48, resizeMode: 'cover' },
  lineThumbPlaceholder: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  lineInfo: { flex: 1, minWidth: 0 },
  lineName: { fontSize: FONTS.size.sm, fontWeight: '500', color: COLORS.text },
  lineMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  qtyInput: {
    width: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  amountLabelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  fillAmountBtn: { paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  fillAmountBtnText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  label: { fontSize: FONTS.size.sm, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  required: { color: COLORS.error },
  optional: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: '400' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: SIZES.md, fontSize: FONTS.size.sm, color: COLORS.text, backgroundColor: COLORS.background,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: SIZES.md, backgroundColor: COLORS.background,
  },
  selectorLocked: { opacity: 0.9, borderStyle: 'dashed' as const, borderColor: COLORS.textSecondary + '80' },
  selectorText: { fontSize: FONTS.size.sm, color: COLORS.text },
  lockedTypeHint: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 6, lineHeight: 16 },
  charCount: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md, marginBottom: SIZES.sm },
  btnOutline: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingVertical: SIZES.md, alignItems: 'center',
  },
  btnOutlineText: { fontSize: FONTS.size.md, color: COLORS.text, fontWeight: '500' },
  btnPrimary: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: 10,
    paddingVertical: SIZES.md, alignItems: 'center',
  },
  btnDestructive: {
    flex: 1, backgroundColor: COLORS.error, borderRadius: 10,
    paddingVertical: SIZES.md, alignItems: 'center',
  },
  btnPrimaryText: { fontSize: FONTS.size.md, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SIZES.lg },
  pickerBox: { backgroundColor: COLORS.card, borderRadius: 16, padding: SIZES.lg },
  pickerTitle: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.text, marginBottom: SIZES.md },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerItemActive: { backgroundColor: COLORS.primary + '10', marginHorizontal: -SIZES.lg, paddingHorizontal: SIZES.lg },
  pickerItemText: { fontSize: FONTS.size.sm, color: COLORS.text },
  pickerItemTextActive: { color: COLORS.primary, fontWeight: '600' },

  confirmBox: { backgroundColor: COLORS.card, borderRadius: 16, padding: SIZES.lg },
  confirmTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text, marginBottom: SIZES.sm },
  confirmMsg: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SIZES.md },
})
