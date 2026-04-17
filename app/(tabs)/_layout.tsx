import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS } from '@/constants/theme'
import { useCartStore } from '@/store/cart-store'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Min bottom inset when OS reports 0 but device still has gesture/home bar. */
function tabBarBottomInset(insetsBottom: number) {
  const floor = Platform.OS === 'android' ? 14 : 10
  return Math.max(insetsBottom, floor)
}

export default function TabsLayout() {
  const cartTotal = useCartStore((state) => state.getTotalItems())
  const insets = useSafeAreaInsets()
  const bottomInset = tabBarBottomInset(insets.bottom)
  const paddingTop = 8
  const contentMin = 44

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingTop,
          paddingBottom: bottomInset,
          height: paddingTop + contentMin + bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: FONTS.size.xs,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Danh mục',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Đơn hàng',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tôi',          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person-outline" size={size} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
})
