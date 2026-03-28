import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
  loading?: boolean
}

export default function ErrorState({ message, onRetry, loading }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && !loading && (
        <Text style={styles.retry} onPress={onRetry}>
          Thử lại
        </Text>
      )}
      {loading && <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />}
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
  message: {
    fontSize: FONTS.size.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  retry: {
    fontSize: FONTS.size.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SIZES.md,
  },
  loader: {
    marginTop: SIZES.md,
  },
})
