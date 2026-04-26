import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { reviewService } from '@/services/review-service'
import type { ProductReview, ProductReviewStatsDto } from '@/types/review'
import { COLORS, SIZES } from '@/constants/theme'

const ACCENT = '#ee4d2d'
const PAGE_SIZE = 8

type StorefrontFilter = 'all' | '5' | '4' | '3' | '2' | '1' | 'comment' | 'image'

function filterToQuery(f: StorefrontFilter): {
  rating?: number
  hasComment?: boolean
  hasImage?: boolean
} {
  switch (f) {
    case 'all':
      return {}
    case '5':
      return { rating: 5 }
    case '4':
      return { rating: 4 }
    case '3':
      return { rating: 3 }
    case '2':
      return { rating: 2 }
    case '1':
      return { rating: 1 }
    case 'comment':
      return { hasComment: true }
    case 'image':
      return { hasImage: true }
    default:
      return {}
  }
}

type SortV = 'newest' | 'rating' | 'rating_asc'

function ReviewerAvatar({ name }: { name: string }) {
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f97316', '#ec4899']
  const safe = (name || '?').trim()
  const color = colors[safe.charCodeAt(0) % colors.length]
  const initials = safe
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <View style={[styles.av, { backgroundColor: color }]}>
      <Text style={styles.avText}>{initials || '?'}</Text>
    </View>
  )
}

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** BE trả camelCase; phòng khi client/proxy còn PascalCase */
function pickSellerReply(r: ProductReview): string {
  const x = r as ProductReview & { SellerReply?: string | null }
  const s = r.sellerReply ?? x.SellerReply
  return typeof s === 'string' ? s.trim() : ''
}

type Props = {
  productId: string
  averageRating: number
  reviewCount: number
}

export function StorefrontProductReviews({ productId, averageRating, reviewCount }: Props) {
  const [filter, setFilter] = useState<StorefrontFilter>('all')
  const [sortBy, setSortBy] = useState<SortV>('newest')
  const [stats, setStats] = useState<ProductReviewStatsDto | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let c = true
    setStatsLoading(true)
    void reviewService
      .getProductReviewStats(productId)
      .then((r) => {
        if (c && r?.success && r.data) setStats(r.data)
      })
      .catch(() => {
        if (c) setStats(null)
      })
      .finally(() => {
        if (c) setStatsLoading(false)
      })
    return () => {
      c = false
    }
  }, [productId])

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const q = filterToQuery(filter)
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await reviewService.getProductReviews(productId, {
          page: nextPage,
          pageSize: PAGE_SIZE,
          sortBy,
          ...q,
        })
        if (res.success) {
          setTotal(res.totalCount)
          setReviews((prev) => (append ? [...prev, ...res.reviews] : res.reviews))
          setPage(nextPage)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [productId, filter, sortBy]
  )

  useEffect(() => {
    setReviews([])
    setPage(1)
    void load(1, false)
  }, [productId, filter, sortBy, load])

  const s = stats
  const chip = (key: StorefrontFilter, label: string, count: number) => (
    <TouchableOpacity
      key={key}
      onPress={() => setFilter(key)}
      style={[styles.chip, filter === key && styles.chipOn]}
    >
      <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  )

  const canLoadMore = reviews.length < total

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={styles.titleBar} />
        <Text style={styles.h2}>Đánh giá sản phẩm</Text>
      </View>

      <View style={styles.scoreBlock}>
        <Text style={styles.scoreNum}>{averageRating > 0 ? averageRating.toFixed(1) : '—'}</Text>
        <Text style={styles.scoreSub}>trên 5</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons
              key={i}
              name="star"
              size={16}
              color={i <= Math.round(averageRating) ? ACCENT : '#e5e7eb'}
            />
          ))}
        </View>
        <Text style={styles.reviewCountMeta}>{reviewCount} đánh giá</Text>
      </View>

      <Text style={styles.locoLabel}>Lọc theo</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {statsLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
        ) : (
          <>
            {chip('all', 'Tất cả', s?.total ?? reviewCount)}
            {chip('5', '5 sao', s?.count5 ?? 0)}
            {chip('4', '4 sao', s?.count4 ?? 0)}
            {chip('3', '3 sao', s?.count3 ?? 0)}
            {chip('2', '2 sao', s?.count2 ?? 0)}
            {chip('1', '1 sao', s?.count1 ?? 0)}
            {chip('comment', 'Có bình luận', s?.withComment ?? 0)}
            {chip('image', 'Có hình ảnh', s?.withImage ?? 0)}
          </>
        )}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sắp xếp</Text>
        <View style={styles.sortBtns}>
          {(
            [
              ['newest', 'Mới nhất'],
              ['rating', 'Sao cao'],
              ['rating_asc', 'Sao thấp'],
            ] as const
          ).map(([v, label]) => (
            <TouchableOpacity
              key={v}
              onPress={() => setSortBy(v)}
              style={[styles.sortChip, sortBy === v && styles.sortChipOn]}
            >
              <Text style={[styles.sortChipT, sortBy === v && styles.sortChipTOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && reviews.length === 0 ? (
        <View style={styles.innerLoad}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        reviews.map((r) => {
          const sellerReply = pickSellerReply(r)
          return (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <ReviewerAvatar name={r.userName || '?'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.uname}>{r.userName || 'Khách'}</Text>
                  <View style={styles.starsRowSm}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons
                        key={i}
                        name="star"
                        size={12}
                        color={i <= r.rating ? ACCENT : '#eee'}
                      />
                    ))}
                    <Text style={styles.reviewTime}> {formatDt(r.createdAt)}</Text>
                  </View>
                </View>
              </View>
              {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
              {r.imageUrls && r.imageUrls.length > 0 ? (
                <ScrollView horizontal style={styles.imgRow} showsHorizontalScrollIndicator={false}>
                  {r.imageUrls.map((u) => (
                    <Image key={u} source={{ uri: u }} style={styles.revImg} />
                  ))}
                </ScrollView>
              ) : null}
              {sellerReply ? (
                <View style={styles.sellerBox}>
                  <Text style={styles.sellerLabel}>Phản hồi của người bán</Text>
                  <Text style={styles.sellerTxt}>{sellerReply}</Text>
                </View>
              ) : null}
            </View>
          )
        })
      )}

      {canLoadMore && !loading && (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => void load(page + 1, true)}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Text style={styles.moreBtnT}>Xem thêm đánh giá</Text>
          )}
        </TouchableOpacity>
      )}

      {!loading && reviews.length === 0 && (
        <Text style={styles.empty}>Chưa có đánh giá nào.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    padding: SIZES.lg,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.md },
  titleBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: COLORS.primary },
  h2: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  scoreBlock: { marginBottom: 12, alignItems: 'flex-start' },
  scoreNum: { fontSize: 28, fontWeight: '800', color: ACCENT },
  scoreSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  starsRow: { flexDirection: 'row', marginTop: 4, gap: 2 },
  reviewCountMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  locoLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipOn: { borderColor: ACCENT, backgroundColor: 'rgba(238,77,45,0.08)' },
  chipText: { fontSize: 11, color: '#374151' },
  chipTextOn: { color: ACCENT, fontWeight: '600' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  sortLabel: { fontSize: 12, color: COLORS.textSecondary },
  sortBtns: { flexDirection: 'row', gap: 6 },
  sortChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  sortChipOn: { borderColor: ACCENT, backgroundColor: 'rgba(238,77,45,0.06)' },
  sortChipT: { fontSize: 11, color: '#4b5563' },
  sortChipTOn: { color: ACCENT, fontWeight: '600' },
  innerLoad: { padding: 24, alignItems: 'center' },
  reviewCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  reviewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  uname: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  starsRowSm: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  reviewTime: { fontSize: 11, color: COLORS.textSecondary },
  comment: { fontSize: 13, color: '#374151', marginTop: 8, lineHeight: 20 },
  imgRow: { marginTop: 8 },
  revImg: { width: 64, height: 64, borderRadius: 6, marginRight: 6 },
  sellerBox: { marginTop: 10, padding: 10, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  sellerLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  sellerTxt: { fontSize: 12, color: '#4b5563', lineHeight: 18 },
  moreBtn: { paddingVertical: 12, alignItems: 'center' },
  moreBtnT: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  empty: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 8, fontSize: 13 },
})
