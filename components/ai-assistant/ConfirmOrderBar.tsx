import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import type { Address } from '@/types/user'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export type AiPaymentMethod = 'vnpay' | 'momo'

interface Props {
  visible: boolean
  addresses: Address[]
  selectedAddressId: string
  onSelectAddress: (id: string) => void
  paymentMethod: AiPaymentMethod
  onPaymentMethod: (m: AiPaymentMethod) => void
  onConfirm: () => void
  onCancel: () => void
  onOpenAddresses: () => void
  loading: boolean
}

export default function ConfirmOrderBar({
  visible,
  addresses,
  selectedAddressId,
  onSelectAddress,
  paymentMethod,
  onPaymentMethod,
  onConfirm,
  onCancel,
  onOpenAddresses,
  loading,
}: Props) {
  if (!visible) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Tạo đơn từ giỏ</Text>
      <Text style={styles.sub}>Chọn địa chỉ và cổng thanh toán</Text>

      <View style={styles.rowBetween}>
        <Text style={styles.label}>Địa chỉ giao hàng</Text>
        <TouchableOpacity onPress={onOpenAddresses}>
          <Text style={styles.link}>Quản lý địa chỉ</Text>
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        <Text style={styles.warn}>Bạn chưa có địa chỉ. Thêm trong hồ sơ.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addrScroll}>
          {addresses.map((a) => {
            const active = a.id === selectedAddressId
            const line = [a.addressLine1, a.ward, a.district, a.city].filter(Boolean).join(', ')
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.addrChip, active && styles.addrChipOn]}
                onPress={() => onSelectAddress(a.id)}
              >
                <Text style={styles.addrChipTitle} numberOfLines={1}>
                  {a.label || a.fullName || 'Địa chỉ'}
                  {a.isDefault ? ' · Mặc định' : ''}
                </Text>
                <Text style={styles.addrChipLine} numberOfLines={2}>
                  {line}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      <Text style={[styles.label, { marginTop: SIZES.md }]}>Thanh toán</Text>
      <View style={styles.payRow}>
        <TouchableOpacity
          style={[styles.payChip, paymentMethod === 'vnpay' && styles.payChipOn]}
          onPress={() => onPaymentMethod('vnpay')}
        >
          <Text style={[styles.payText, paymentMethod === 'vnpay' && styles.payTextOn]}>VNPay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.payChip, paymentMethod === 'momo' && styles.payChipOn]}
          onPress={() => onPaymentMethod('momo')}
        >
          <Text style={[styles.payText, paymentMethod === 'momo' && styles.payTextOn]}>MoMo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnGhost} onPress={onCancel} disabled={loading}>
          <Text style={styles.btnGhostText}>Để sau</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={loading || !selectedAddressId || addresses.length === 0}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <Text style={styles.btnPrimaryText}>Tạo đơn & thanh toán</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.chatRowHighlight,
    padding: SIZES.md,
  },
  title: { fontSize: FONTS.size.md, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4, marginBottom: SIZES.sm },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  label: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  link: { fontSize: FONTS.size.xs, color: COLORS.primary, fontWeight: '600' },
  warn: { fontSize: FONTS.size.sm, color: COLORS.error, marginVertical: SIZES.sm },
  addrScroll: { maxHeight: 88 },
  addrChip: {
    width: 200,
    marginRight: SIZES.sm,
    padding: SIZES.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  addrChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.chatRowHighlight },
  addrChipTitle: { fontSize: FONTS.size.xs, fontWeight: '700', color: COLORS.text },
  addrChipLine: { fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginTop: 4 },
  payRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.xs },
  payChip: {
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  payChipOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  payText: { fontSize: FONTS.size.sm, fontWeight: '600', color: COLORS.text },
  payTextOn: { color: COLORS.onPrimary },
  actions: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  btnGhost: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { fontWeight: '600', color: COLORS.textSecondary },
  btnPrimary: {
    flex: 2,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontWeight: '800', color: COLORS.onPrimary, fontSize: FONTS.size.sm },
})
