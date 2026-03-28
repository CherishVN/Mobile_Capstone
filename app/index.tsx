import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/auth-store'
import Loading from '@/components/Loading'

export default function Index() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return

    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/auth/login')
      } else {
        router.replace('/(tabs)/home')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading])

  return <Loading />
}
