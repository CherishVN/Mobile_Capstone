export interface ChatMessageDto {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: 'buyer' | 'seller'
  messageType: string
  content: string
  isRead: boolean
  createdAt: string
}

export interface ConversationDto {
  id: string
  shopId: string
  shopName: string
  shopLogoUrl: string | null
  buyerId: string
  buyerName: string
  buyerAvatarUrl?: string | null
  sellerId: string
  orderId: string | null
  lastMessage: ChatMessageDto | null
  unreadCount: number
  createdAt: string
  isMuted?: boolean
}

export interface ConversationDetailDto {
  conversation: ConversationDto
  messages: ChatMessageDto[]
  totalMessages: number
  page: number
  pageSize: number
}
