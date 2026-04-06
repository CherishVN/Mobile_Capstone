import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { reviewService } from '@/services/review-service'
import Button from '@/components/Button'
import StarRatingInput from '@/components/StarRatingInput'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  orderId: string
  productId: string
  productName: string
  onSubmitted: () => void
}

export default function ProductReviewModal({
  visible,
  onClose,
  orderId,
  productId,
  productName,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setRating(5)
      setComment('')
    }
  }, [visible, productId])

  const submit = async () => {
    setSaving(true)
    try {
      const res = await reviewService.createProductReview({
        orderId,
        productId,
        rating,
        comment: comment.trim() || undefined,
      })
      if (res.success) {
        onSubmitted()
        onClose()
      } else {
        Alert.alert('Đánh giá', res.message || 'Không gửi được đánh giá')
      }
    } catch (e: any) {
      Alert.alert('Đánh giá', e?.message || 'Không gửi được đánh giá')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <Text style={styles.title}>Đánh giá sản phẩm</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>

          <StarRatingInput value={rating} onChange={setRating} label="Số sao" />

          <Text style={styles.inputLabel}>Nhận xét (tùy chọn)</Text>
          <TextInput
            style={styles.input}
            placeholder="Chia sẻ trải nghiệm của bạn…"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={500}
            value={comment}
            onChangeText={setComment}
          />
          <Text style={styles.count}>{comment.length}/500</Text>

          <Button
            title="Gửi đánh giá"
            onPress={submit}
            loading={saving}
            fullWidth
            disabled={rating < 1}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SIZES.lg,
    paddingBottom: SIZES.xl,
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  productName: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
  },
  inputLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SIZES.md,
    fontSize: FONTS.size.md,
    color: COLORS.text,
    textAlignVertical: 'top',
    backgroundColor: COLORS.background,
  },
  count: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginBottom: SIZES.md,
  },
})
