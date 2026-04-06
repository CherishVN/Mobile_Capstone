/**
 * Đồng bộ với FE `shopio-assistant-widget.tsx`: cache UI đầy đủ theo sessionId
 * vì BE chỉ trả tin nhắn text (không có products / responseMeta).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AssistantUiMessage } from '@/types/ai-chat'

export const AI_CHAT_CACHE_PREFIX = 'ai-chat-ui-state:'

export type ProductSelection = { checked: boolean; quantity: number }

export type ConfirmTargetCache = { cartId?: string; messageId: string }

export type AiChatUiCachePayload = {
  messages: AssistantUiMessage[]
  confirmTarget: ConfirmTargetCache | null
  selectedAddressId: string
  selectedProductsByMessageId: Record<string, Record<string, ProductSelection>>
}

export async function readAiChatUiCache(sessionId: string): Promise<AiChatUiCachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(`${AI_CHAT_CACHE_PREFIX}${sessionId}`)
    if (!raw) return null
    return JSON.parse(raw) as AiChatUiCachePayload
  } catch {
    return null
  }
}

export async function writeAiChatUiCache(sessionId: string, payload: AiChatUiCachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(`${AI_CHAT_CACHE_PREFIX}${sessionId}`, JSON.stringify(payload))
  } catch {
    /* bỏ qua hết quota / lỗi lưu */
  }
}

export async function removeAiChatUiCache(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${AI_CHAT_CACHE_PREFIX}${sessionId}`)
  } catch {
    /* ignore */
  }
}
