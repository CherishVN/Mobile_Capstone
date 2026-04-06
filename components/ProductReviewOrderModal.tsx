import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { reviewService } from '@/services/review-service'
import type { Order, OrderItem } from '@/types/order'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

type ItemState = { rating: number; comment: string; imageDataUrls: string[] }

interface Props {
  visible: boolean
  order: Order
  onClose: () => void
  onSuccess: () => void
}

const MAX_IMAGES = 5

export default function ProductReviewOrderModal({
  visible,
  order,
  onClose,
  onSuccess,
}: Props) {
  const pendingItems = useMemo(
    () => order.items.filter((i) => i.hasReviewedByUser !== true),
    [order.items]
  )

  const [byProduct, setByProduct] = useState<Record<string, ItemState>>({})
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => {
    if (!visible) return
    const init: Record<string, ItemState> = {}
    for (const it of pendingItems) {
      init[it.productId] = { rating: 5, comment: '', imageDataUrls: [] }
    }
    setByProduct(init)
  }, [visible, pendingItems])

  const patch = useCallback((productId: string, p: Partial<ItemState>) => {
    setByProduct((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...p },
    }))
  }, [])

  const pickImages = async (productId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để đính kèm hình.')
      return
    }

    const remaining = MAX_IMAGES - (byProduct[productId]?.imageDataUrls?.length ?? 0)
    if (remaining <= 0) {
      Alert.alert('Giới hạn', `Tối đa ${MAX_IMAGES} ảnh mỗi sản phẩm.`)
      return
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      base64: true,
      quality: 0.85,
    })

    if (res.canceled || !res.assets?.length) return

    setByProduct((prev) => {
      const base = prev[productId] ?? { rating: 5, comment: '', imageDataUrls: [] }
      const cur = base.imageDataUrls
      const remaining = MAX_IMAGES - cur.length
      if (remaining <= 0) return prev

      const urls: string[] = [...cur]
      for (const a of res.assets) {
        if (urls.length >= MAX_IMAGES) break
        if (!a.base64) continue
        const mime = a.mimeType || 'image/jpeg'
        urls.push(`data:${mime};base64,${a.base64}`)
      }
      return { ...prev, [productId]: { ...base, imageDataUrls: urls } }
    })
  }

  const removeImage = (productId: string, index: number) => {
    setByProduct((prev) => {
      const base = prev[productId]
      if (!base) return prev
      return {
        ...prev,
        [productId]: {
          ...base,
          imageDataUrls: base.imageDataUrls.filter((_, i) => i !== index),
        },
      }
    })
  }

  const submit = async () => {
    if (pendingItems.length === 0) {
      onClose()
      return
    }
    setSubmitting(true)
    let ok = 0
    let fail = 0
    for (const it of pendingItems) {
      const st = byProduct[it.productId]
      if (!st) continue
      try {
        const r = await reviewService.createProductReview({
          orderId: order.id,
          productId: it.productId,
          rating: st.rating,
          comment: st.comment.trim() || undefined,
          imageUrls: st.imageDataUrls.length ? st.imageDataUrls : undefined,
        })
        if (r.success) ok++
        else fail++
      } catch {
        fail++
      }
    }
    setSubmitting(false)
    if (ok > 0) {
      Alert.alert('Thành công', `Đã gửi ${ok} đánh giá sản phẩm.`)
      onSuccess()
    }
    if (fail > 0) {
      Alert.alert(
        'Một phần thất bại',
        `${fail} đánh giá không gửi được (có thể đã đánh giá trước đó).`
      )
    }
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Đánh giá sản phẩm</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {pendingItems.length === 0 ? (
              <Text style={styles.empty}>Bạn đã đánh giá tất cả sản phẩm trong đơn.</Text>
            ) : (
              pendingItems.map((item) => (
                <ReviewBlock
                  key={item.productId}
                  item={item}
                  state={byProduct[item.productId]}
                  onRating={(n) => patch(item.productId, { rating: n })}
                  onComment={(t) => patch(item.productId, { comment: t })}
                  onPickImages={() => pickImages(item.productId)}
                  onRemoveImage={(idx) => removeImage(item.productId, idx)}
                />
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={submitting}>
              <Text style={styles.btnGhostText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={submit}
              disabled={submitting || pendingItems.length === 0}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.btnPrimaryText}>Gửi đánh giá</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ReviewBlock({
  item,
  state,
  onRating,
  onComment,
  onPickImages,
  onRemoveImage,
}: {
  item: OrderItem
  state?: ItemState
  onRating: (n: number) => void
  onComment: (t: string) => void
  onPickImages: () => void
  onRemoveImage: (i: number) => void
}) {
  const rating = state?.rating ?? 5
  const comment = state?.comment ?? ''
  const imgs = state?.imageDataUrls ?? []

  return (
    <View style={styles.block}>
      <View style={styles.rowTop}>
        {item.productImage ? (
          <Image source={{ uri: item.productImage }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPh]}>
            <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
          </View>
        )}
        <Text style={styles.pname} numberOfLines={2}>
          {item.productName}
        </Text>
      </View>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onRating(n)} hitSlop={6}>
            <Ionicons
              name={n <= rating ? 'star' : 'star-outline'}
              size={28}
              color={n <= rating ? '#f59c2a' : COLORS.border}
            />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Nhận xét (không bắt buộc)"
        placeholderTextColor={COLORS.textSecondary}
        value={comment}
        onChangeText={onComment}
        multiline
        maxLength={2000}
      />
      <View style={styles.imgRow}>
        {imgs.map((uri, idx) => (
          <View key={idx} style={styles.imgWrap}>
            <Image source={{ uri }} style={styles.preview} />
            <TouchableOpacity style={styles.imgRemove} onPress={() => onRemoveImage(idx)}>
              <Ionicons name="close-circle" size={22} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ))}
        {imgs.length < MAX_IMAGES && (
          <TouchableOpacity style={styles.addImg} onPress={onPickImages}>
            <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
            <Text style={styles.addImgText}>Ảnh</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: SIZES.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  body: {
    paddingHorizontal: SIZES.lg,
    maxHeight: 420,
  },
  empty: {
    padding: SIZES.xl,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.md,
  },
  btnGhost: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  btnGhostText: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  block: {
    paddingVertical: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowTop: {
    flexDirection: 'row',
    gap: SIZES.md,
    alignItems: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.chatBackground,
  },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  pname: { flex: 1, fontSize: FONTS.size.md, fontWeight: '600', color: COLORS.text },
  stars: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  input: {
    marginTop: SIZES.md,
    minHeight: 72,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SIZES.md,
    textAlignVertical: 'top',
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  imgRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginTop: SIZES.md,
  },
  imgWrap: { position: 'relative' },
  preview: { width: 64, height: 64, borderRadius: 8 },
  imgRemove: { position: 'absolute', top: -6, right: -6 },
  addImg: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  addImgText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
})
