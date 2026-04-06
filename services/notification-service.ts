import { api } from '@/lib/api-client'
import { NotificationListResponse } from '@/types/notification'

export const notificationService = {
  getNotifications: (params: { page?: number; pageSize?: number; isRead?: boolean } = {}) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', String(params.page))
    if (params.pageSize) q.set('pageSize', String(params.pageSize))
    if (params.isRead !== undefined) q.set('isRead', String(params.isRead))
    const qs = q.toString()
    return api.get<NotificationListResponse>(
      `/api/notifications${qs ? `?${qs}` : ''}`
    )
  },

  markAsRead: (id: string) =>
    api.put<{ success: boolean; message?: string }>(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.put<{ success: boolean; message?: string }>('/api/notifications/read-all'),
}
