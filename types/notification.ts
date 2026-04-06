export interface AppNotification {
  id: string
  type: string
  title: string
  content: string
  referenceType?: string | null
  referenceId?: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationListResponse {
  success: boolean
  message?: string
  notifications: AppNotification[]
  totalCount: number
  unreadCount: number
  page: number
  pageSize: number
}
