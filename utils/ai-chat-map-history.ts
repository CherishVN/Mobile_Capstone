import type { AiChatSendResponse, AssistantUiMessage, ProductSuggestion } from '@/types/ai-chat'

function normalizeProducts(products: ProductSuggestion[]): ProductSuggestion[] {
  return products.map((p) => ({
    ...p,
    id: p.id != null ? String(p.id) : '',
  }))
}

/** Map dòng lịch sử API → AssistantUiMessage (products + sendResponse khi có SP). */
export function mapHistoryToAssistantUi(
  sessionId: string,
  m: {
    id: string | number
    role: 'user' | 'assistant'
    content: string
    createdAt?: string
    products?: ProductSuggestion[] | null
  }
): AssistantUiMessage {
  const id = typeof m.id === 'string' ? m.id : String(m.id)
  const base: AssistantUiMessage = {
    id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }
  const list = m.products?.length ? normalizeProducts(m.products) : undefined
  if (m.role === 'assistant' && list?.length) {
    const sendResponse: AiChatSendResponse = {
      reply: m.content,
      intent: 'general',
      products: list,
      needsConfirmation: false,
      cartUpdated: false,
      sessionId,
    }
    return { ...base, products: list, sendResponse }
  }
  return base
}
