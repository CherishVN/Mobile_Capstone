/**
 * Giống FE `dedupeMergedChatMessages`: gộp cache + BE, ưu tiên bản assistant có `products`.
 */
import type { ProductSuggestion } from '@/types/ai-chat'

export type MergeableAssistantMessage = {
  id: string | number
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  products?: ProductSuggestion[] | null
}

function normalizeChatMessageContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ')
}

const DEDUPE_WINDOW_MS = 120_000

function timeMs(m: MergeableAssistantMessage): number | null {
  if (!m.createdAt) return null
  const t = new Date(m.createdAt).getTime()
  return Number.isFinite(t) ? t : null
}

function isDuplicatePair(a: MergeableAssistantMessage, b: MergeableAssistantMessage): boolean {
  if (a.role !== b.role) return false
  if (normalizeChatMessageContent(a.content) !== normalizeChatMessageContent(b.content)) return false

  const ta = timeMs(a)
  const tb = timeMs(b)
  if (ta === null && tb === null) return true
  if (ta === null || tb === null) return false
  return Math.abs(ta - tb) <= DEDUPE_WINDOW_MS
}

export function dedupeMergedAssistantMessages<T extends MergeableAssistantMessage>(messages: T[]): T[] {
  const sorted = [...messages].sort((a, b) => {
    const ta = timeMs(a) ?? 0
    const tb = timeMs(b) ?? 0
    return ta - tb
  })

  const out: T[] = []
  for (const m of sorted) {
    const dupIdx = out.findIndex((x) => isDuplicatePair(x, m))

    if (dupIdx < 0) {
      out.push(m)
      continue
    }

    const prev = out[dupIdx]
    if (m.role === 'assistant') {
      const mRich = (m.products?.length ?? 0) > 0
      const pRich = (prev.products?.length ?? 0) > 0
      if (mRich && !pRich) out[dupIdx] = m
      continue
    }

    const preferM = String(m.id).startsWith('u-') && !String(prev.id).startsWith('u-')
    if (preferM) out[dupIdx] = m
  }
  return out
}
