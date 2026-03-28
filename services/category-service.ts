import { api } from '@/lib/api-client'
import { Category } from '@/types/category'
import { ApiResponse, CategoryResponse } from '@/types/api'

export const categoryService = {
  getCategories: (page = 1, pageSize = 100) => 
    api.get<CategoryResponse>(`/api/categories?page=${page}&pageSize=${pageSize}`),

  getCategoryById: (categoryId: number) =>
    api.get<ApiResponse<Category>>(`/api/categories/${categoryId}`),
}
