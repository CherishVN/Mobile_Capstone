import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface TabBarProps {
  tabs: string[]
  activeTab: number
  onTabChange: (index: number) => void
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.tab, activeTab === index && styles.tabActive]}
          onPress={() => onTabChange(index)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: SIZES.xs,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: SIZES.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: COLORS.background,
  },
  tabText: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
})
