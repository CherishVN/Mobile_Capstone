import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { COLORS, FONTS, SIZES } from '@/constants/theme'

export default function SplashScreen() {
  const router = useRouter()
  const fadeAnim = new Animated.Value(0)

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        router.replace('/')
      }, 500)
    })
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.logo}>🛍️</Text>
        <Text style={styles.title}>E-Commerce</Text>
        <Text style={styles.subtitle}>Local Brands Platform</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 80,
    marginBottom: SIZES.lg,
  },
  title: {
    fontSize: FONTS.size.xxxl,
    fontWeight: 'bold',
    color: COLORS.background,
    marginBottom: SIZES.xs,
  },
  subtitle: {
    fontSize: FONTS.size.md,
    color: COLORS.background,
    opacity: 0.8,
  },
})
