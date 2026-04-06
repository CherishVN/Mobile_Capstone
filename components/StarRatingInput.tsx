import React from 'react'
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface Props {
  value: number
  onChange: (n: number) => void
  label?: string
}

export default function StarRatingInput({ value, onChange, label }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons
              name={n <= value ? 'star' : 'star-outline'}
              size={32}
              color={n <= value ? '#f59c2a' : COLORS.border}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SIZES.md,
  },
  label: {
    fontSize: FONTS.size.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  row: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
})
