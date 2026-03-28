import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface InfoCardProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value: string | number
  subtitle?: string
  iconColor?: string
  style?: ViewStyle
}

export default function InfoCard({
  icon,
  title,
  value,
  subtitle,
  iconColor = COLORS.primary,
  style,
}: InfoCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    gap: SIZES.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xs,
  },
  value: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
})
