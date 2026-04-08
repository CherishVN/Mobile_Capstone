import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS, SIZES, FONTS } from '@/constants/theme'
import {
  customerWalletService,
  type CustomerWalletDto,
  type CustomerWalletLedgerItem,
  type CustomerWithdrawalRequestDto,
} from '@/services/customer-wallet-service'

const BANKS = [
  'Vietcombank', 'MB Bank', 'Techcombank', 'VPBank', 'ACB',
  'BIDV', 'Agribank', 'Sacombank', 'TPBank', 'HDBank',
]
const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 2_000_000]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}
function formatDate(s: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(s))
}

const WITHDRAWAL_STATUS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7' },
  1: { label: 'Đã duyệt',  color: '#1d4ed8', bg: '#dbeafe' },
  2: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
  3: { label: 'Đã thanh toán', color: '#16a34a', bg: '#dcfce7' },
}

type Tab = 'transactions' | 'requests'
type ModalStep = 'bank' | 'form' | 'confirm'

export default function WalletScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [wallet, setWallet] = useState<CustomerWalletDto | null>(null)
  const [transactions, setTransactions] = useState<CustomerWalletLedgerItem[]>([])
  const [requests, setRequests] = useState<CustomerWithdrawalRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('transactions')

  const [modalVisible, setModalVisible] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>('bank')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ bankName: '', bankAccountNumber: '', bankAccountName: '', amount: '' })
  const [bankSearch, setBankSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const [wRes, txRes, rqRes] = await Promise.all([
        customerWalletService.getWallet(),
        customerWalletService.getTransactions(1, 30),
        customerWalletService.getWithdrawalRequests(1, 30),
      ])
      if (wRes.success) setWallet(wRes.data)
      if (txRes.success) setTransactions(txRes.transactions ?? [])
      if (rqRes.success) setRequests(rqRes.requests ?? [])
    } catch {
      Alert.alert('Lỗi', 'Không thể tải thông tin ví')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  const openModal = () => {
    setForm({ bankName: '', bankAccountNumber: '', bankAccountName: '', amount: '' })
    setBankSearch('')
    setModalStep('bank')
    setModalVisible(true)
  }

  const availableBalance = wallet?.availableBalance ?? 0
  const amountNum = Number(form.amount.replace(/\D/g, ''))
  const hasPending = requests.some((r) => r.status === 0)

  const canProceed =
    !!form.bankName &&
    form.bankAccountNumber.length >= 6 &&
    !!form.bankAccountName.trim() &&
    amountNum >= 10_000 &&
    amountNum <= availableBalance

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      const res = await customerWalletService.createWithdrawalRequest({
        amount: amountNum,
        bankName: form.bankName,
        bankAccountNumber: form.bankAccountNumber,
        bankAccountName: form.bankAccountName,
      })
      if (res.success) {
        setModalVisible(false)
        Alert.alert('Thành công', 'Yêu cầu rút tiền đã được gửi')
        await load()
      } else {
        Alert.alert('Lỗi', res.message ?? 'Không thể gửi yêu cầu')
      }
    } catch {
      Alert.alert('Lỗi', 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredBanks = bankSearch.trim()
    ? BANKS.filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase()))
    : BANKS

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ví của tôi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(availableBalance)}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceMeta}>
              Tổng nhận: <Text style={styles.balanceMetaVal}>{formatCurrency(wallet?.totalRefunded ?? 0)}</Text>
            </Text>
            <Text style={styles.balanceMeta}>
              Đã rút: <Text style={styles.balanceMetaVal}>{formatCurrency(wallet?.totalWithdrawn ?? 0)}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.withdrawBtn, (availableBalance <= 0 || hasPending) && styles.withdrawBtnDisabled]}
            onPress={openModal}
            disabled={availableBalance <= 0 || hasPending}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={COLORS.onPrimary} />
            <Text style={styles.withdrawBtnText}>Yêu cầu rút tiền</Text>
          </TouchableOpacity>
          {hasPending && (
            <Text style={styles.pendingHint}>Bạn đang có yêu cầu chờ xử lý</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['transactions', 'requests'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'transactions' ? 'Lịch sử giao dịch' : 'Lịch sử rút tiền'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.listWrap}>
          {tab === 'transactions' && (
            transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'refund' ? '#dcfce7' : '#fee2e2' }]}>
                    <Ionicons
                      name={tx.type === 'refund' ? 'add-circle' : 'remove-circle'}
                      size={20}
                      color={tx.type === 'refund' ? '#16a34a' : '#dc2626'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txNote} numberOfLines={1}>
                      {tx.note ?? (tx.type === 'refund' ? 'Hoàn tiền' : 'Rút tiền')}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'refund' ? '#16a34a' : '#dc2626' }]}>
                    {tx.type === 'refund' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))
            )
          )}

          {tab === 'requests' && (
            requests.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có yêu cầu rút tiền nào</Text>
            ) : (
              requests.map((req) => {
                const st = WITHDRAWAL_STATUS[req.status] ?? WITHDRAWAL_STATUS[0]
                return (
                  <View key={req.id} style={styles.reqCard}>
                    <View style={styles.reqTop}>
                      <Text style={styles.reqAmount}>{formatCurrency(req.amount)}</Text>
                      <View style={[styles.badge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.reqMeta}>{req.bankName} · {req.bankAccountNumber} · {req.bankAccountName}</Text>
                    <Text style={styles.reqDate}>Yêu cầu lúc {formatDate(req.requestedAt)}</Text>
                    {req.reviewedAt && (
                      <Text style={styles.reqDate}>Xử lý lúc {formatDate(req.reviewedAt)}</Text>
                    )}
                    {!!req.rejectionReason && (
                      <Text style={styles.reqReject}>Lý do từ chối: {req.rejectionReason}</Text>
                    )}
                  </View>
                )
              })
            )
          )}
        </View>
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + SIZES.md }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                if (modalStep === 'form') setModalStep('bank')
                else if (modalStep === 'confirm') setModalStep('form')
                else setModalVisible(false)
              }}>
                <Ionicons name={modalStep === 'bank' ? 'close' : 'arrow-back'} size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {modalStep === 'bank' ? 'Chọn ngân hàng' : modalStep === 'form' ? 'Thông tin rút tiền' : 'Xác nhận rút tiền'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Step: bank */}
            {modalStep === 'bank' && (
              <>
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm ngân hàng..."
                    placeholderTextColor={COLORS.placeholder}
                    value={bankSearch}
                    onChangeText={setBankSearch}
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>
                <ScrollView style={{ maxHeight: 320 }}>
                  {filteredBanks.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.bankItem, form.bankName === b && styles.bankItemActive]}
                      onPress={() => { setForm((f) => ({ ...f, bankName: b })); setModalStep('form') }}
                    >
                      <Text style={[styles.bankItemText, form.bankName === b && { color: COLORS.primary }]}>{b}</Text>
                      {form.bankName === b && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Step: form */}
            {modalStep === 'form' && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Ngân hàng</Text>
                  <TouchableOpacity style={styles.formSelect} onPress={() => setModalStep('bank')}>
                    <Text style={[styles.formSelectText, !form.bankName && { color: COLORS.placeholder }]}>
                      {form.bankName || 'Chọn ngân hàng...'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Số tài khoản</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    placeholder="Nhập số tài khoản"
                    placeholderTextColor={COLORS.placeholder}
                    value={form.bankAccountNumber}
                    onChangeText={(v) => setForm((f) => ({ ...f, bankAccountNumber: v.replace(/\D/g, '') }))}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Tên chủ tài khoản</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="NGUYEN VAN A"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    value={form.bankAccountName}
                    onChangeText={(v) => setForm((f) => ({ ...f, bankAccountName: v.toUpperCase() }))}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Số tiền (khả dụng: {formatCurrency(availableBalance)})
                  </Text>
                  <View style={styles.amountWrap}>
                    <Text style={styles.amountCurrency}>₫</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.placeholder}
                      value={form.amount}
                      onChangeText={(v) => {
                        const raw = v.replace(/\D/g, '')
                        const num = raw ? Math.min(Number(raw), availableBalance) : 0
                        setForm((f) => ({ ...f, amount: num > 0 ? num.toLocaleString('vi-VN') : '' }))
                      }}
                    />
                  </View>
                  {amountNum > 0 && amountNum < 10_000 && (
                    <Text style={styles.formError}>Số tiền tối thiểu là 10.000 ₫</Text>
                  )}
                  <View style={styles.quickRow}>
                    {QUICK_AMOUNTS.map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.quickBtn, v > availableBalance && styles.quickBtnDisabled]}
                        disabled={v > availableBalance}
                        onPress={() => setForm((f) => ({ ...f, amount: v.toLocaleString('vi-VN') }))}
                      >
                        <Text style={styles.quickBtnText}>{v >= 1_000_000 ? `${v / 1_000_000}tr` : `${v / 1_000}k`}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.quickBtn, styles.quickBtnAll, availableBalance <= 0 && styles.quickBtnDisabled]}
                      disabled={availableBalance <= 0}
                      onPress={() => setForm((f) => ({ ...f, amount: availableBalance.toLocaleString('vi-VN') }))}
                    >
                      <Text style={[styles.quickBtnText, { color: COLORS.primary }]}>Tất cả</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, !canProceed && styles.primaryBtnDisabled]}
                  disabled={!canProceed}
                  onPress={() => setModalStep('confirm')}
                >
                  <Text style={styles.primaryBtnText}>Tiếp theo</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Step: confirm */}
            {modalStep === 'confirm' && (
              <>
                <View style={styles.confirmCard}>
                  {[
                    ['Ngân hàng', form.bankName],
                    ['Số tài khoản', form.bankAccountNumber],
                    ['Chủ tài khoản', form.bankAccountName],
                    ['Số tiền', formatCurrency(amountNum)],
                  ].map(([label, value], i) => (
                    <View key={label} style={[styles.confirmRow, i % 2 === 0 && { backgroundColor: COLORS.background }]}>
                      <Text style={styles.confirmLabel}>{label}</Text>
                      <Text style={styles.confirmValue}>{value}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.confirmHint}>
                  Vui lòng kiểm tra kỹ thông tin. Yêu cầu không thể hoàn tác sau khi gửi.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                  disabled={submitting}
                  onPress={handleSubmit}
                >
                  {submitting
                    ? <ActivityIndicator color={COLORS.onPrimary} />
                    : <Text style={styles.primaryBtnText}>Xác nhận rút tiền</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.md,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SIZES.xs },
  headerTitle: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.text },

  balanceCard: {
    margin: SIZES.md, borderRadius: 16, padding: SIZES.lg,
    backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa',
  },
  balanceLabel: { fontSize: FONTS.size.sm, color: '#c2410c', fontWeight: '600', marginBottom: 4 },
  balanceAmount: { fontSize: FONTS.size.xxxl, fontWeight: '800', color: COLORS.primary, marginBottom: SIZES.sm },
  balanceRow: { flexDirection: 'row', gap: SIZES.lg, marginBottom: SIZES.md },
  balanceMeta: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  balanceMetaVal: { fontWeight: '700', color: COLORS.text },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 12,
  },
  withdrawBtnDisabled: { opacity: 0.5 },
  withdrawBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONTS.size.sm },
  pendingHint: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  listWrap: { backgroundColor: COLORS.card, marginTop: SIZES.sm, paddingHorizontal: SIZES.md },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: SIZES.xl, fontSize: FONTS.size.sm },

  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.md,
    gap: SIZES.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  txNote: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  txDate: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmount: { fontSize: FONTS.size.sm, fontWeight: '700' },

  reqCard: {
    paddingVertical: SIZES.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 4,
  },
  reqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reqAmount: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: FONTS.size.xs, fontWeight: '600' },
  reqMeta: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  reqDate: { fontSize: FONTS.size.xs, color: COLORS.textSecondary },
  reqReject: { fontSize: FONTS.size.xs, color: COLORS.error },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SIZES.md, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SIZES.md,
  },
  modalTitle: { fontSize: FONTS.size.md, fontWeight: '700', color: COLORS.text },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: SIZES.sm, paddingVertical: SIZES.xs, marginBottom: SIZES.sm,
  },
  searchInput: { flex: 1, fontSize: FONTS.size.sm, color: COLORS.text },
  bankItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: SIZES.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  bankItemActive: { backgroundColor: COLORS.chatRowHighlight },
  bankItemText: { fontSize: FONTS.size.sm, color: COLORS.text },

  formGroup: { marginBottom: SIZES.md },
  formLabel: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  formInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: SIZES.md, paddingVertical: 10,
    fontSize: FONTS.size.sm, color: COLORS.text,
  },
  formSelect: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: SIZES.md, paddingVertical: 10,
  },
  formSelectText: { fontSize: FONTS.size.sm, color: COLORS.text },
  formError: { fontSize: FONTS.size.xs, color: COLORS.error, marginTop: 4 },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: SIZES.md,
  },
  amountCurrency: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginRight: 6 },
  amountInput: { flex: 1, fontSize: FONTS.size.sm, color: COLORS.text, paddingVertical: 10 },
  quickRow: { flexDirection: 'row', gap: SIZES.xs, marginTop: SIZES.sm, flexWrap: 'wrap' },
  quickBtn: {
    flex: 1, minWidth: 60, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingVertical: 6, alignItems: 'center', backgroundColor: COLORS.card,
  },
  quickBtnAll: { borderColor: COLORS.primary + '60' },
  quickBtnDisabled: { opacity: 0.35 },
  quickBtnText: { fontSize: FONTS.size.xs, fontWeight: '600', color: COLORS.text },

  primaryBtn: {
    backgroundColor: COLORS.text, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: SIZES.md,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONTS.size.sm },

  confirmCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'hidden', marginTop: SIZES.sm },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SIZES.md, paddingVertical: 10 },
  confirmLabel: { fontSize: FONTS.size.sm, color: COLORS.textSecondary },
  confirmValue: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  confirmHint: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, textAlign: 'center', marginTop: SIZES.sm },
})
