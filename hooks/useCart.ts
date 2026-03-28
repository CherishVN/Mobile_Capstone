import { useEffect } from 'react'
import { cartService } from '@/services/cart-service'
import { useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'

export function useCart() {
  const { cart, setCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      loadCart()
    }
  }, [isAuthenticated])

  const loadCart = async () => {
    try {
      const response = await cartService.getMyCart()
      if (response.success && response.data) {
        setCart(response.data)
      }
    } catch (error) {
      console.error('Failed to load cart:', error)
    }
  }

  const addToCart = async (productId: string, variantId?: string, quantity: number = 1) => {
    try {
      await cartService.addItem({ productId, variantId, quantity })
      await loadCart()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      await cartService.updateItem(itemId, { quantity })
      await loadCart()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      await cartService.removeItem(itemId)
      await loadCart()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return {
    cart,
    loadCart,
    addToCart,
    updateQuantity,
    removeItem,
  }
}
