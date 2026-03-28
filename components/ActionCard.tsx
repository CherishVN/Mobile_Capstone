import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface ActionCardProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  onPress?: () => void
  rightIcon?: keyof typeof Ionicons.glyphMap
  style?: ViewStyle
}

export default function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  rightIcon = 'chevron-forward',
  style,
}: ActionCardProps) {
  const Component = onPress ? TouchableOpacity : View

  return (
    <Component
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.left}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {onPress && (
        <Ionicons name={rightIcon} size={20} color={COLORS.textSecondary} />
      )}
    </Component>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SIZES.md,
    borderRadius: 12,
    marginBottom: SIZES.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.size.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
})
