import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  action?: React.ReactNode
  style?: ViewStyle
}

export default function EmptyState({
  icon = 'file-tray-outline',
  title,
  subtitle,
  action,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon} size={64} color={COLORS.textSecondary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
  },
  title: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
  },
  action: {
    marginTop: SIZES.lg,
  },
})
