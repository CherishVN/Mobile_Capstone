import { aiApi } from '@/lib/ai-api-client'
import { api } from '@/lib/api-client'
import type {
  AiChatConfirmOrderResponse,
  AiChatSendResponse,
  AiChatSessionResponse,
  AiChatShopShippingOption,
  AiSessionsListResponse,
  AiSessionMessagesResponse,
} from '@/types/ai-chat'

export const aiChatService = {
  getOrCreateSession: () =>
    aiApi.post<AiChatSessionResponse>('/api/ai/chat/session'),

  createNewSession: () =>
    aiApi.post<AiChatSessionResponse>('/api/ai/chat/session/new'),

  getHistory: (sessionId: string) =>
    aiApi.get<AiChatSessionResponse>(`/api/ai/chat/history/${sessionId}`),

  sendMessage: (sessionId: string, message: string) =>
    aiApi.post<AiChatSendResponse>('/api/ai/chat/send', { sessionId, message }),

  confirmOrder: (
    sessionId: string,
    cartId: string,
    shippingAddressId: string,
    shippingOptions: AiChatShopShippingOption[],
  ) =>
    aiApi.post<AiChatConfirmOrderResponse>('/api/ai/chat/confirm-order', {
      sessionId,
      cartId,
      shippingAddressId,
      shippingOptions,
    }),

  /** ECommerceAPI — lịch sử phiên trong DB */
  listSessions: (page = 1, pageSize = 20) =>
    api.get<AiSessionsListResponse>(`/api/ai/sessions?page=${page}&pageSize=${pageSize}`),

  getSessionMessages: (sessionId: string) =>
    api.get<AiSessionMessagesResponse>(`/api/ai/sessions/${sessionId}/messages`),

  markSessionRead: (sessionId: string) =>
    api.post<{ success: boolean; sessionId: string; unreadCount: number }>(
      `/api/ai/sessions/${sessionId}/read`
    ),

  setSessionMuted: (sessionId: string, isMuted: boolean) =>
    api.patch<{ success: boolean; sessionId: string; isMuted: boolean }>(
      `/api/ai/sessions/${sessionId}/mute`,
      { isMuted }
    ),

  deleteSession: (sessionId: string) =>
    api.delete<{ success: boolean; sessionId: string }>(`/api/ai/sessions/${sessionId}`),
}
