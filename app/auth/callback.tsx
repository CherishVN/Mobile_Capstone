import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import Loading from '@/components/Loading'

export default function AuthCallbackScreen() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        router.replace('/(tabs)/home')
      } else {
        router.replace('/auth/login')
      }
    })()
  }, [router])

  return <Loading />
}
