import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/types/user'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        // Refresh token không hợp lệ hoặc hết hạn → xóa session cũ
        await supabase.auth.signOut()
        set({ user: null, isAuthenticated: false, isLoading: false })
      } else if (session) {
        set({ isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      // AuthApiError: Invalid Refresh Token → xóa session bị hỏng
      await supabase.auth.signOut()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        set({ user: null, isAuthenticated: false, isLoading: false })
      } else {
        set({ isAuthenticated: true, isLoading: false })
      }
    })
  },
}))
