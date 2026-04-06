import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Order, OrderItem } from '@/types/order'
import { reviewService } from '@/services/review-service'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

const RATING_LABELS = ['', 'Tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời']

interface ReviewItemState {
  rating: number
  comment: string
}

interface ReviewModalProps {
  visible: boolean
  order: Order
  onClose: () => void
  onSuccess: () => void
}

export default function ReviewModal({ visible, order, onClose, onSuccess }: ReviewModalProps) {
  const pendingItems = order.items.filter((i) => i.hasReviewedByUser !== true)

  const [reviews, setReviews] = useState<Record<string, ReviewItemState>>(() => {
    const init: Record<string, ReviewItemState> = {}
    for (const item of pendingItems) {
      init[item.productId] = { rating: 5, comment: '' }
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)

  const updateReview = (productId: string, patch: Partial<ReviewItemState>) => {
    setReviews((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }))
  }

  const handleSubmit = async () => {
    if (pendingItems.length === 0) return

    setSubmitting(true)
    let successCount = 0
    let failedCount = 0

    for (const item of pendingItems) {
      const review = reviews[item.productId]
      if (!review) continue

      try {
        const res = await reviewService.createProductReview({
          orderId: order.id,
          productId: item.productId,
          rating: review.rating,
          comment: review.comment || undefined,
        })
        if (res.success) {
          successCount++
        } else {
          failedCount++
        }
      } catch {
        failedCount++
      }
    }

    setSubmitting(false)

    if (successCount > 0) {
      Alert.alert('Thành công', `Đánh giá ${successCount} sản phẩm thành công!`)
      onSuccess()
    }
    if (failedCount > 0) {
      Alert.alert('Lỗi', `${failedCount} sản phẩm đánh giá thất bại`)
    }
    onClose()
  }

  if (pendingItems.length === 0) return null

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Đánh Giá Sản Phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {pendingItems.map((item, index) => (
              <View key={item.productId}>
                <ReviewItemCard
                  item={item}
                  review={reviews[item.productId]}
                  onStarClick={(star) => updateReview(item.productId, { rating: star })}
                  onCommentChange={(c) => updateReview(item.productId, { comment: c })}
                />
                {index < pendingItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>TRỞ LẠI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || pendingItems.length === 0}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              ) : (
                <Text style={styles.submitText}>HOÀN THÀNH</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ReviewItemCard({
  item,
  review,
  onStarClick,
  onCommentChange,
}: {
  item: OrderItem
  review: ReviewItemState
  onStarClick: (star: number) => void
  onCommentChange: (c: string) => void
}) {
  return (
    <View style={styles.reviewItem}>
      {/* Product info */}
      <View style={styles.productRow}>
        <View style={styles.productImage}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.productImageImg} />
          ) : (
            <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          {item.variantName && (
            <Text style={styles.productVariant}>Phân loại hàng: {item.variantName}</Text>
          )}
        </View>
      </View>

      {/* Star rating */}
      <View style={styles.ratingRow}>
        <Text style={styles.ratingLabel}>Chất lượng sản phẩm</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => onStarClick(star)} activeOpacity={0.7}>
              <Ionicons
                name={star <= review.rating ? 'star' : 'star-outline'}
                size={32}
                color={star <= review.rating ? '#fbbf24' : '#d1d5db'}
              />
            </TouchableOpacity>
          ))}
        </View>
        {review.rating > 0 && (
          <Text style={styles.ratingText}>{RATING_LABELS[review.rating]}</Text>
        )}
      </View>

      {/* Comment */}
      <TextInput
        style={styles.commentInput}
        value={review.comment}
        onChangeText={onCommentChange}
        placeholder="Hãy chia sẻ những điều bạn thích về sản phẩm này..."
        placeholderTextColor={COLORS.placeholder}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: SIZES.xs,
  },
  content: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SIZES.md,
  },
  footer: {
    flexDirection: 'row',
    gap: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  reviewItem: {
    gap: SIZES.md,
  },
  productRow: {
    flexDirection: 'row',
    gap: SIZES.md,
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImageImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  productVariant: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    alignItems: 'center',
    gap: SIZES.sm,
  },
  ratingLabel: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
  },
  starsRow: {
    flexDirection: 'row',
    gap: SIZES.xs,
  },
  ratingText: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: SIZES.md,
    fontSize: FONTS.size.sm,
    color: COLORS.text,
    minHeight: 100,
  },
})
