import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { reviewService } from '@/services/review-service'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const STORAGE_PREFIX = '@ecom:shopReviewOrder:'

interface Props {
  visible: boolean
  orderId: string
  shopId: string
  shopName: string
  onClose: () => void
  onSuccess: () => void
}

export async function markShopReviewedForOrder(orderId: string) {
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${orderId}`, '1')
}

export async function hasStoredShopReviewForOrder(orderId: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(`${STORAGE_PREFIX}${orderId}`)
  return v === '1'
}

export default function ShopReviewOrderModal({
  visible,
  orderId,
  shopId,
  shopName,
  onClose,
  onSuccess,
}: Props) {
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setRating(5)
    setTitle('')
    setContent('')
  }

  React.useEffect(() => {
    if (visible) reset()
  }, [visible])

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await reviewService.createShopReview({
        shopId,
        orderId,
        rating,
        title: title.trim() || undefined,
        content: content.trim() || undefined,
      })
      if (res.success) {
        await markShopReviewedForOrder(orderId)
        Alert.alert('Thành công', 'Cảm ơn bạn đã đánh giá cửa hàng.')
        onSuccess()
        onClose()
      } else {
        Alert.alert('Không gửi được', res.message || 'Thử lại sau.')
      }
    } catch (e: any) {
      const msg = e?.message || 'Không gửi được đánh giá'
      if (/đã đánh giá/i.test(msg)) {
        await markShopReviewedForOrder(orderId)
        onSuccess()
        onClose()
        Alert.alert('Thông báo', 'Bạn đã đánh giá shop cho đơn này trước đó.')
      } else {
        Alert.alert('Lỗi', msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Đánh giá cửa hàng</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.shopName} numberOfLines={2}>
            {shopName}
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={n <= rating ? '#f59c2a' : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Tiêu đề (tối đa 100 ký tự)"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Nội dung (tối đa 500 ký tự)"
            placeholderTextColor={COLORS.textSecondary}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={submitting}>
              <Text style={styles.btnGhostText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.btnPrimaryText}>Gửi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SIZES.lg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SIZES.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  shopName: {
    marginTop: SIZES.sm,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  stars: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginVertical: SIZES.lg,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SIZES.md,
    fontSize: FONTS.size.md,
    color: COLORS.text,
    marginBottom: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.md },
  btnGhost: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  btnGhostText: { fontWeight: '600', color: COLORS.textSecondary },
  btnPrimary: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontWeight: '700', color: COLORS.onPrimary },
})
