import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface HeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  rightAction?: React.ReactNode
  showBack?: boolean
}

export default function Header({
  title,
  subtitle,
  onBack,
  rightAction,
  showBack = false,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {showBack && onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
        {!rightAction && showBack && <View style={styles.placeholder} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.xxl + 10,
    paddingBottom: SIZES.md,
  },
  backButton: {
    padding: SIZES.xs,
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: SIZES.sm,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  rightAction: {
    padding: SIZES.xs,
  },
  placeholder: {
    width: 40,
  },
})
