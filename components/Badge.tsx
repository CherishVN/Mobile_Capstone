import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface BadgeProps {
  text: string
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'secondary'
  style?: ViewStyle
}

export default function Badge({ text, variant = 'primary', style }: BadgeProps) {
  const backgroundColor =
    variant === 'success'
      ? COLORS.success + '20'
      : variant === 'error'
      ? COLORS.error + '20'
      : variant === 'warning'
      ? COLORS.warning + '20'
      : variant === 'secondary'
      ? COLORS.textSecondary + '20'
      : COLORS.primary + '20'

  const textColor =
    variant === 'success'
      ? COLORS.success
      : variant === 'error'
      ? COLORS.error
      : variant === 'warning'
      ? COLORS.warning
      : variant === 'secondary'
      ? COLORS.textSecondary
      : COLORS.primary

  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text style={[styles.text, { color: textColor }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
})
