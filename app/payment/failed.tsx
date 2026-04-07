import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

export default function PaymentFailedScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ message?: string | string[] }>()
  const raw = typeof params.message === 'string' ? params.message : params.message?.[0]
  const msg = raw ? decodeURIComponent(raw) : 'Thanh toán không thành công.'

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Thanh toán thất bại</Text>
      <Text style={styles.sub}>{msg}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)/orders')}>
        <Text style={styles.btnText}>Về đơn hàng</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: SIZES.xl,
    backgroundColor: COLORS.background,
  },
  title: { fontSize: FONTS.size.lg, fontWeight: '700', color: COLORS.error, marginBottom: SIZES.sm },
  sub: { fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: SIZES.xl },
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: FONTS.size.md },
})
