import { useEffect, useState } from 'react'
import { userService } from '@/services/user-service'
import { useAuthStore } from '@/store/auth-store'
import { UserProfile } from '@/types/user'

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isAuthenticated, setUser } = useAuthStore()

  const loadProfile = async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await userService.getProfile()
      if (response.success && response.data) {
        setProfile(response.data)
        setUser(response.data)
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin người dùng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [isAuthenticated])

  const updateProfile = async (data: { fullName?: string; phone?: string }) => {
    try {
      await userService.updateProfile(data)
      await loadProfile()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  return {
    profile,
    loading,
    error,
    refetch: loadProfile,
    updateProfile,
  }
}
