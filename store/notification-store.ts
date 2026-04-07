import { create } from 'zustand'
import { notificationService } from '@/services/notification-service'

interface NotificationState {
  unreadCount: number
  setUnreadCount: (count: number) => void
  fetchUnreadCount: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

let pollingInterval: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 30_000

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,

  setUnreadCount: (count) => set({ unreadCount: count }),

  fetchUnreadCount: async () => {
    try {
      const res = await notificationService.getNotifications({ pageSize: 1 })
      if (res.success) {
        set({ unreadCount: res.unreadCount })
      }
    } catch {
      /* ignore – user may be logged out */
    }
  },

  startPolling: () => {
    get().fetchUnreadCount()
    if (pollingInterval) clearInterval(pollingInterval)
    pollingInterval = setInterval(() => {
      get().fetchUnreadCount()
    }, POLL_INTERVAL_MS)
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    set({ unreadCount: 0 })
  },
}))
