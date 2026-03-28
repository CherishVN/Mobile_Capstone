import { create } from 'zustand'
import { Cart, CartItem } from '@/types/cart'

interface CartState {
  cart: Cart | null
  setCart: (cart: Cart | null) => void
  getTotalItems: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,

  setCart: (cart) => set({ cart }),

  getTotalItems: () => {
    const cart = get().cart
    return cart?.totalItems || 0
  },
}))
