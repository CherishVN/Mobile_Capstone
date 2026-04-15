import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { disputeService } from '@/services/dispute-service'
import {
  DisputeStatus,
  DisputeStatusLabels,
  DisputeStatusColors,
  DisputeTypeLabels,
  CANCELLABLE_DISPUTE_STATUSES,
  type CustomerDispute,
} from '@/types/dispute'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// --- Evidence picker (reused from list page) ---
interface EvidencePickerProps {
  urls: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}

function EvidencePicker({ urls, onChange, disabled }: EvidencePickerProps) {
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
      } catch { /* bỏ qua */ }
    }
    setUploading(false)
    if (newUrls.length) onChange([...urls, ...newUrls])
  }

  const remove = (idx: number) => onChange(urls.filter((_, i) => i !== idx))

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
          {uploading
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <>
                <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
                <Text style={epStyles.addBtnText}>Thêm ảnh/video</Text>
              </>
          }
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
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 120,
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

// --- Info Row ---
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValue}>{children}</View>
    </View>
  )
}

// --- Main Screen ---
export default function DisputeDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [dispute, setDispute] = useState<CustomerDispute | null>(null)
  const [loading, setLoading] = useState(true)

  // Cancel
  const [cancelVisible, setCancelVisible] = useState(false)
  const [canceling, setCanceling] = useState(false)

  // Update evidence / respond
  const [respondVisible, setRespondVisible] = useState(false)
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [customerNote, setCustomerNote] = useState('')
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await disputeService.getDisputeById(id)
      if (res.success && res.dispute) {
        setDispute(res.dispute)
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không tìm thấy khiếu nại', [
          { text: 'OK', onPress: () => router.back() },
        ])
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể tải khiếu nại', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const openRespond = () => {
    if (!dispute) return
    setEvidenceUrls([...dispute.evidenceUrls])
    setCustomerNote(dispute.customerNote ?? '')
    setRespondVisible(true)
  }

  const handleUpdateEvidence = async () => {
    if (!dispute) return
    const isWaiting = dispute.status === DisputeStatus.WaitingCustomer
    if (isWaiting && !customerNote.trim() && evidenceUrls.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập phản hồi hoặc đính kèm bằng chứng')
      return
    }
    if (!isWaiting && evidenceUrls.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng thêm ít nhất 1 bằng chứng')
      return
    }
    setUpdating(true)
    try {
      const res = await disputeService.updateEvidence(
        dispute.id,
        evidenceUrls,
        customerNote.trim() || undefined,
      )
      if (res.success) {
        Alert.alert('Thành công', isWaiting ? 'Đã gửi phản hồi' : 'Đã cập nhật bằng chứng')
        setRespondVisible(false)
        load()
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không cập nhật được')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không cập nhật được')
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = async () => {
    if (!dispute) return
    setCanceling(true)
    try {
      const res = await disputeService.cancelDispute(dispute.id)
      if (res.success) {
        Alert.alert('Thành công', 'Đã hủy khiếu nại')
        setCancelVisible(false)
        load()
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không hủy được')
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không hủy được')
    } finally {
      setCanceling(false)
    }
  }

  const canCancel = dispute !== null && CANCELLABLE_DISPUTE_STATUSES.has(dispute.status)
  const isWaitingCustomer = dispute?.status === DisputeStatus.WaitingCustomer

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (!dispute) return null

  const statusColor = DisputeStatusColors[dispute.status] ?? '#9ca3af'

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Chi tiết khiếu nại</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { borderLeftColor: statusColor }]}>
          <View style={styles.statusBannerLeft}>
            <Text style={styles.disputeTitle} numberOfLines={2}>{dispute.title}</Text>
            <Text style={styles.disputeMeta}>{dispute.shopName} · {formatDateTime(dispute.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {DisputeStatusLabels[dispute.status] ?? dispute.statusName}
            </Text>
          </View>
        </View>

        {/* WaitingCustomer notice */}
        {isWaitingCustomer && (
          <View style={styles.waitingNotice}>
            <Ionicons name="alert-circle" size={18} color="#4338ca" />
            <View style={{ flex: 1 }}>
              <Text style={styles.waitingNoticeTitle}>Admin đang chờ phản hồi từ bạn</Text>
              <Text style={styles.waitingNoticeDesc}>
                Nhấn &ldquo;Gửi phản hồi&rdquo; bên dưới để cung cấp thêm thông tin hoặc bằng chứng.
              </Text>
            </View>
          </View>
        )}

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin khiếu nại</Text>
          <InfoRow label="Loại">
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{DisputeTypeLabels[dispute.type] ?? dispute.typeName}</Text>
            </View>
          </InfoRow>
          <InfoRow label="Số tiền yêu cầu">
            <Text style={styles.amountText}>{formatPrice(dispute.requestedAmount)}</Text>
          </InfoRow>
          {dispute.approvedAmount !== null && (
            <InfoRow label="Số tiền duyệt">
              <Text style={styles.approvedText}>{formatPrice(dispute.approvedAmount)}</Text>
            </InfoRow>
          )}
          <InfoRow label="Ngày tạo">
            <Text style={styles.metaText}>{formatDateTime(dispute.createdAt)}</Text>
          </InfoRow>
          <InfoRow label="Cập nhật">
            <Text style={styles.metaText}>{formatDateTime(dispute.updatedAt)}</Text>
          </InfoRow>
        </View>

        {/* Reason & Evidence card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Lý do & Bằng chứng</Text>
            {dispute.canUpdateEvidence && (
              <TouchableOpacity
                style={[styles.actionBtn, isWaitingCustomer && styles.actionBtnIndigo]}
                onPress={openRespond}
              >
                <Ionicons
                  name={isWaitingCustomer ? 'chatbubble-outline' : 'cloud-upload-outline'}
                  size={14}
                  color={isWaitingCustomer ? '#4338ca' : COLORS.primary}
                />
                <Text style={[styles.actionBtnText, isWaitingCustomer && { color: '#4338ca' }]}>
                  {isWaitingCustomer ? 'Gửi phản hồi' : 'Cập nhật bằng chứng'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.reasonText}>{dispute.reason}</Text>

          {/* Customer note */}
          {dispute.customerNote && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Phản hồi bổ sung của bạn</Text>
              <Text style={styles.noteText}>{dispute.customerNote}</Text>
            </View>
          )}

          {/* Customer evidence */}
          {dispute.evidenceUrls.length > 0 && (
            <View style={styles.evidenceSection}>
              <Text style={styles.evidenceSectionLabel}>Bằng chứng của bạn ({dispute.evidenceUrls.length})</Text>
              <View style={styles.evidenceList}>
                {dispute.evidenceUrls.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.evidenceChip}
                    onPress={() => Linking.openURL(url)}
                  >
                    <Ionicons name="image-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.evidenceChipText}>Bằng chứng {i + 1}</Text>
                    <Ionicons name="open-outline" size={12} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Seller response card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phản hồi từ người bán</Text>
          {dispute.sellerResponse ? (
            <>
              <Text style={styles.sellerResponseText}>{dispute.sellerResponse}</Text>
              {dispute.sellerRespondedAt && (
                <Text style={styles.sellerResponseDate}>{formatDateTime(dispute.sellerRespondedAt)}</Text>
              )}
              {dispute.sellerEvidenceUrls.length > 0 && (
                <View style={[styles.evidenceSection, { marginTop: SIZES.sm }]}>
                  <Text style={styles.evidenceSectionLabel}>Bằng chứng từ seller ({dispute.sellerEvidenceUrls.length})</Text>
                  <View style={styles.evidenceList}>
                    {dispute.sellerEvidenceUrls.map((url, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.evidenceChip, styles.evidenceChipSeller]}
                        onPress={() => Linking.openURL(url)}
                      >
                        <Ionicons name="image-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={[styles.evidenceChipText, { color: COLORS.textSecondary }]}>Bằng chứng {i + 1}</Text>
                        <Ionicons name="open-outline" size={12} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>Người bán chưa phản hồi</Text>
          )}
        </View>

        {/* Resolution card */}
        {dispute.resolution && (
          <View style={[styles.card, styles.resolutionCard]}>
            <Text style={styles.resolutionTitle}>Kết luận từ Admin</Text>
            <Text style={styles.resolutionText}>{dispute.resolution}</Text>
          </View>
        )}

        {/* Cancel action */}
        {canCancel && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelDispute}
              onPress={() => setCancelVisible(true)}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
              <Text style={styles.cancelDisputeText}>Hủy khiếu nại</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: SIZES.xxl }} />
      </ScrollView>

      {/* Respond / Update evidence modal */}
      <Modal
        visible={respondVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRespondVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isWaitingCustomer ? 'Gửi phản hồi bổ sung' : 'Cập nhật bằng chứng'}
              </Text>
              <TouchableOpacity onPress={() => setRespondVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDesc}>
                {isWaitingCustomer
                  ? 'Admin đang chờ thêm thông tin từ bạn. Bạn có thể viết giải thích và/hoặc đính kèm ảnh, video.'
                  : 'Tải lên ảnh hoặc video từ thiết bị (tối đa 10 file).'}
              </Text>

              {isWaitingCustomer && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nội dung phản hồi</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    placeholder="Viết thêm giải thích, thông tin bổ sung cho admin..."
                    placeholderTextColor={COLORS.placeholder}
                    value={customerNote}
                    onChangeText={setCustomerNote}
                    multiline
                    numberOfLines={4}
                    maxLength={2000}
                    textAlignVertical="top"
                    editable={!updating}
                  />
                  <Text style={styles.charCount}>{customerNote.length}/2000</Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Bằng chứng đính kèm</Text>
                <EvidencePicker urls={evidenceUrls} onChange={setEvidenceUrls} disabled={updating} />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => setRespondVisible(false)}
                  disabled={updating}
                >
                  <Text style={styles.btnOutlineText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, updating && styles.btnDisabled]}
                  onPress={handleUpdateEvidence}
                  disabled={updating}
                >
                  {updating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnPrimaryText}>
                        {isWaitingCustomer ? 'Gửi phản hồi' : 'Lưu bằng chứng'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal
        visible={cancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Xác nhận hủy khiếu nại</Text>
            <Text style={styles.confirmMsg}>
              Bạn có chắc muốn hủy khiếu nại &ldquo;{dispute.title}&rdquo;? Hành động này không thể hoàn tác.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => setCancelVisible(false)} disabled={canceling}>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg, paddingTop: SIZES.xxl + 10, paddingBottom: SIZES.md,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SIZES.xs },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text, flex: 1, textAlign: 'center' },

  statusBanner: {
    backgroundColor: COLORS.card, margin: SIZES.md, borderRadius: 12,
    padding: SIZES.md, flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm,
    borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  statusBannerLeft: { flex: 1 },
  disputeTitle: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  disputeMeta: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: FONTS.size.xs, fontWeight: '700' },

  waitingNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm,
    marginHorizontal: SIZES.md, marginBottom: SIZES.sm,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
    borderRadius: 10, padding: SIZES.md,
  },
  waitingNoticeTitle: { fontSize: FONTS.size.sm, fontWeight: '600', color: '#3730a3', marginBottom: 2 },
  waitingNoticeDesc: { fontSize: FONTS.size.xs, color: '#4338ca', lineHeight: 18 },

  card: {
    backgroundColor: COLORS.card, marginHorizontal: SIZES.md, marginBottom: SIZES.sm,
    borderRadius: 12, padding: SIZES.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: FONTS.size.sm, fontWeight: '700', color: COLORS.text, marginBottom: SIZES.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  actionBtnIndigo: { borderColor: '#818cf8' },
  actionBtnText: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, flex: 0.45 },
  infoValue: { flex: 0.55, alignItems: 'flex-end' },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  typeBadgeText: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, fontWeight: '500' },
  amountText: { fontSize: FONTS.size.sm, fontWeight: '700', color: COLORS.primary },
  approvedText: { fontSize: FONTS.size.sm, fontWeight: '700', color: '#16a34a' },
  metaText: { fontSize: FONTS.size.xs, color: COLORS.text, textAlign: 'right' },

  reasonText: { fontSize: FONTS.size.sm, color: COLORS.text, lineHeight: 22, marginBottom: SIZES.sm },
  noteBox: {
    backgroundColor: '#f9fafb', borderRadius: 8, padding: SIZES.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SIZES.sm,
  },
  noteLabel: { fontSize: FONTS.size.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText: { fontSize: FONTS.size.sm, color: COLORS.text, lineHeight: 20 },
  evidenceSection: { marginTop: SIZES.sm },
  evidenceSectionLabel: { fontSize: FONTS.size.xs, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  evidenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  evidenceChipSeller: { backgroundColor: '#f9fafb', borderColor: COLORS.border },
  evidenceChipText: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '500' },

  sellerResponseText: { fontSize: FONTS.size.sm, color: COLORS.text, lineHeight: 22 },
  sellerResponseDate: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 },
  emptyText: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, fontStyle: 'italic' },

  resolutionCard: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  resolutionTitle: { fontSize: FONTS.size.sm, fontWeight: '700', color: '#15803d', marginBottom: SIZES.xs },
  resolutionText: { fontSize: FONTS.size.sm, color: '#166534', lineHeight: 22 },

  actionsRow: { marginHorizontal: SIZES.md, marginBottom: SIZES.sm },
  cancelDispute: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10,
    paddingVertical: SIZES.md, backgroundColor: '#fff5f5',
  },
  cancelDisputeText: { fontSize: FONTS.size.md, color: COLORS.error, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SIZES.lg, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.sm },
  modalTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text },
  modalDesc: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: SIZES.md, lineHeight: 20 },
  field: { marginBottom: SIZES.md },
  fieldLabel: { fontSize: FONTS.size.sm, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: SIZES.md, fontSize: FONTS.size.sm, color: COLORS.text, backgroundColor: COLORS.background,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
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

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SIZES.lg },
  confirmBox: { backgroundColor: COLORS.card, borderRadius: 16, padding: SIZES.lg },
  confirmTitle: { fontSize: FONTS.size.lg, fontWeight: 'bold', color: COLORS.text, marginBottom: SIZES.sm },
  confirmMsg: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SIZES.md },
})
