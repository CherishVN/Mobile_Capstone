import { useState, useCallback } from 'react'

interface PaginationState<T> {
  data: T[]
  page: number
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

interface PaginationOptions<T> {
  fetchFn: (page: number) => Promise<{ data: T[]; totalCount: number }>
  pageSize?: number
}

export function usePagination<T>({
  fetchFn,
  pageSize = 20,
}: PaginationOptions<T>): PaginationState<T> {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (pageNum: number, isRefresh = false) => {
    if (isRefresh) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    setError(null)

    try {
      const result = await fetchFn(pageNum)
      
      if (isRefresh) {
        setData(result.data)
      } else {
        setData((prev) => [...prev, ...result.data])
      }

      setHasMore(result.data.length === pageSize)
      setPage(pageNum)
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchData(page + 1, false)
    }
  }, [page, loadingMore, hasMore])

  const refresh = useCallback(async () => {
    await fetchData(1, true)
  }, [])

  return {
    data,
    page,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    refresh,
  }
}
