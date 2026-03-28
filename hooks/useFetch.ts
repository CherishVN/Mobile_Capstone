import { useEffect, useState } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, deps)

  return { data, loading, error, refetch: fetchData }
}
