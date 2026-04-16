import { Link, Stack } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, FONTS, SIZES } from '@/constants/theme'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <View style={styles.container}>
        <Text style={styles.icon}>404</Text>
        <Text style={styles.title}>Trang không tồn tại</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Về trang chủ</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SIZES.lg,
  },
  icon: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SIZES.md,
  },
  title: {
    fontSize: FONTS.size.lg,
    color: COLORS.text,
    marginBottom: SIZES.lg,
  },
  link: {
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
  },
  linkText: {
    fontSize: FONTS.size.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
})
