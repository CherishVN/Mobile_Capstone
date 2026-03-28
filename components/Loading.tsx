import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { COLORS } from '@/constants/theme'

interface LoadingProps {
  size?: 'small' | 'large'
}

export default function Loading({ size = 'large' }: LoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={COLORS.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
})
