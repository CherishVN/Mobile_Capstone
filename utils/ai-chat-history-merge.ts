import type { AssistantUiMessage } from '@/types/ai-chat'

/** Gộp lịch sử từ BE (chủ yếu text) với cache UI local (products, cartId, …) theo id tin nhắn. */
export function mergeHistoryWithUiCache(
  server: AssistantUiMessage[],
  cached: AssistantUiMessage[]
): AssistantUiMessage[] {
  const byId = new Map<string, AssistantUiMessage>()
  for (const m of cached) {
    byId.set(String(m.id), m)
  }
  return server.map((m) => {
    if (m.role !== 'assistant') return m
    const c = byId.get(String(m.id))
    if (!c) return m
    return {
      ...m,
      products: c.products?.length ? c.products : m.products,
      productToAdd: c.productToAdd ?? m.productToAdd,
      cartId: c.cartId ?? m.cartId,
      sendResponse: c.sendResponse ?? m.sendResponse,
    }
  })
}
