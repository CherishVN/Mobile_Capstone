export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface PaginatedResponse<T> {
  success: boolean
  message?: string
  data: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CategoryResponse {
  success: boolean
  message?: string
  categories: any[]
  totalCount: number
  page: number
  pageSize: number
}

export interface ApiError {
  message: string
  statusCode?: number
}
