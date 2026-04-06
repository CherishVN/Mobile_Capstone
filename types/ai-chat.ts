export interface AiChatMessage {
  id: string | number
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export interface ProductToAdd {
  productId?: string
  variantId?: string
  quantity: number
}

export interface VariantSuggestion {
  id: string
  variantName: string
  price?: number | null
}

export interface ProductSuggestion {
  id: string
  slug?: string
  name: string
  basePrice: number
  imageUrl?: string
  categoryName?: string
  matchScore?: number
  matchReason?: string
  variants?: VariantSuggestion[]
}

export interface AiChatSessionResponse {
  sessionId: string
  status: string
  history: AiChatMessage[]
}

export interface AiChatSendResponse {
  reply: string
  intent: string
  products: ProductSuggestion[]
  needsConfirmation: boolean
  cartUpdated: boolean
  cartId?: string
  sessionId: string
  productToAdd?: ProductToAdd | null
}

export interface AiChatConfirmOrderResponse {
  success: boolean
  orderId?: string
  message: string
}

/** Tin nhắn hiển thị (gộp text + gợi ý SP từ một lần trả lời) */
export interface AssistantUiMessage extends AiChatMessage {
  products?: ProductSuggestion[]
  productToAdd?: ProductToAdd | null
  cartId?: string
  /** Giữ meta gốc để xử lý checkout / confirm */
  sendResponse?: AiChatSendResponse
}

export interface AiSessionLastMessage {
  role: string
  content: string
  createdAt?: string
}

export interface AiSessionSummary {
  sessionId: string
  status: string
  createdAt?: string
  updatedAt?: string
  title: string
  lastMessage?: AiSessionLastMessage | null
  messageCount: number
  isMuted?: boolean
  unreadCount?: number
}

export interface AiSessionsListResponse {
  success: boolean
  sessions: AiSessionSummary[]
  totalCount: number
  page: number
  pageSize: number
}

export interface AiSessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export interface AiSessionMessagesResponse {
  success: boolean
  sessionId: string
  messages: AiSessionMessage[]
}

export type SessionFilter = 'all' | 'unread' | 'muted'
