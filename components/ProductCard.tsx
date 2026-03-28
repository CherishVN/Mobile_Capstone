import React from 'react'
import { TouchableOpacity, Text, Image, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Product } from '@/types/product'
import { COLORS, SIZES, FONTS } from '@/constants/theme'

interface ProductCardProps {
  product: Product
  onPress: () => void
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Image
        source={{ uri: product.imageUrls[0] || 'https://via.placeholder.com/150' }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.shop} numberOfLines={1}>
          {product.shopName}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
          <View style={styles.soldContainer}>
            <Ionicons name="bag-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.soldText}>{product.soldCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.card,
  },
  content: {
    padding: SIZES.md,
  },
  name: {
    fontSize: FONTS.size.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  shop: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: FONTS.size.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  soldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
  },
  soldText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textSecondary,
  },
})
