import { aiApi } from '@/lib/ai-api-client'
import type {
  AiChatConfirmOrderResponse,
  AiChatSendResponse,
  AiChatSessionResponse,
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

  confirmOrder: (sessionId: string, cartId: string, shippingAddressId: string) =>
    aiApi.post<AiChatConfirmOrderResponse>('/api/ai/chat/confirm-order', {
      sessionId,
      cartId,
      shippingAddressId,
    }),
}
