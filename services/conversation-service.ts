import { api } from '@/lib/api-client'
import type { ConversationDetailDto, ConversationDto, ChatMessageDto } from '@/types/conversation'

export const conversationService = {
  listMine: async (): Promise<ConversationDto[]> => {
    const res = await api.get<{ success: boolean; data: ConversationDto[] }>('/api/conversations')
    return res.data || []
  },

  startOrGet: async (body: {
    shopId: string
    orderId?: string
    firstMessage?: string
  }): Promise<ConversationDto> => {
    const res = await api.post<{ success: boolean; data: ConversationDto }>(
      '/api/conversations',
      body
    )
    if (!res.data) throw new Error('Không tạo được hội thoại')
    return res.data
  },

  getMessages: async (
    conversationId: string,
    page = 1,
    pageSize = 50
  ): Promise<ConversationDetailDto> => {
    const res = await api.get<{ success: boolean; data: ConversationDetailDto }>(
      `/api/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`
    )
    if (!res.data) throw new Error('Không tải được tin nhắn')
    return res.data
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    messageType = 'text'
  ): Promise<ChatMessageDto> => {
    const res = await api.post<{ success: boolean; data: ChatMessageDto }>(
      `/api/conversations/${conversationId}/messages`,
      { content, messageType }
    )
    if (!res.data) throw new Error('Gửi tin nhắn thất bại')
    return res.data
  },

  markAsRead: (conversationId: string) =>
    api.put<{ success: boolean; message?: string }>(`/api/conversations/${conversationId}/read`),
}
