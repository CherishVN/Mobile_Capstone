import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface ButtonProps extends TouchableOpacityProps {
  title: string
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  icon?: React.ReactNode
}

export default function Button({
  title,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const buttonStyles: ViewStyle[] = [
    styles.button,
    styles[variant],
    styles[`size_${size}`],
    fullWidth ? styles.fullWidth : undefined,
    (disabled || loading) ? styles.disabled : undefined,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[]

  const textStyles: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_size_${size}`],
  ]

  return (
    <TouchableOpacity
      style={buttonStyles}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? COLORS.background : COLORS.primary}
        />
      ) : (
        <>
          {icon && icon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: SIZES.sm,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  size_sm: {
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
  },
  size_md: {
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.lg,
  },
  size_lg: {
    paddingVertical: SIZES.lg,
    paddingHorizontal: SIZES.xl,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  text_primary: {
    color: COLORS.background,
  },
  text_secondary: {
    color: COLORS.background,
  },
  text_outline: {
    color: COLORS.primary,
  },
  text_ghost: {
    color: COLORS.primary,
  },
  text_size_sm: {
    fontSize: FONTS.size.sm,
  },
  text_size_md: {
    fontSize: FONTS.size.md,
  },
  text_size_lg: {
    fontSize: FONTS.size.lg,
  },
})
