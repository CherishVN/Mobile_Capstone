import { api } from '@/lib/api-client'
import { ProductsResponse, ProductDetailResponse } from '@/types/product'

export const productService = {
  getProducts: (params: {
    page?: number
    pageSize?: number
    categoryId?: number
    search?: string
    minPrice?: number
    maxPrice?: number
    sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'best_seller'
  } = {}) => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.set('page', String(params.page))
    if (params.pageSize) queryParams.set('pageSize', String(params.pageSize))
    if (params.categoryId) queryParams.set('categoryId', String(params.categoryId))
    if (params.search) queryParams.set('search', params.search)
    if (params.minPrice !== undefined) queryParams.set('minPrice', String(params.minPrice))
    if (params.maxPrice !== undefined) queryParams.set('maxPrice', String(params.maxPrice))
    if (params.sortBy) queryParams.set('sortBy', params.sortBy)

    const query = queryParams.toString()
    return api.get<ProductsResponse>(`/api/products${query ? `?${query}` : ''}`)
  },

  getProductById: (productId: string) =>
    api.get<ProductDetailResponse>(`/api/products/${productId}`),

  getProductBySlug: (slug: string) =>
    api.get<ProductDetailResponse>(`/api/products/${slug}`),
}
