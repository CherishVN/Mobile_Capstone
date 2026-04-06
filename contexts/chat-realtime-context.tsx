import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type { HubConnection } from '@microsoft/signalr'
import { useAuthStore } from '@/store/auth-store'
import { getAccessToken } from '@/lib/supabase'
import {
  createChatRealtimeConnection,
  startChatRealtimeConnection,
  disposeChatRealtimeConnection,
} from '@/services/chat-realtime'
import type { ChatMessageDto, ConversationDto } from '@/types/conversation'

export type ChatMessageReceivedPayload = {
  conversationId?: string
  message?: ChatMessageDto
}

export type ChatRealtimeHandler = {
  onConversationUpdated?: (c: ConversationDto) => void
  onChatMessageReceived?: (p: ChatMessageReceivedPayload) => void
  onReconnected?: () => void
}

type ChatRealtimeContextValue = {
  register: (h: ChatRealtimeHandler) => () => void
  setActiveConversationId: (id: string | null) => void
  getActiveConversationId: () => string | null
}

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null)

export function ChatRealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const handlersRef = useRef<ChatRealtimeHandler[]>([])
  const activeConversationIdRef = useRef<string | null>(null)
  const connectionRef = useRef<HubConnection | null>(null)

  const register = useCallback((h: ChatRealtimeHandler) => {
    handlersRef.current.push(h)
    return () => {
      handlersRef.current = handlersRef.current.filter((x) => x !== h)
    }
  }, [])

  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id
  }, [])

  const getActiveConversationId = useCallback(() => activeConversationIdRef.current, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const hubHandlers = {
      onConversationUpdated: (c: ConversationDto) => {
        handlersRef.current.forEach((h) => h.onConversationUpdated?.(c))
      },
      onChatMessageReceived: (p: ChatMessageReceivedPayload) => {
        handlersRef.current.forEach((h) => h.onChatMessageReceived?.(p))
      },
      onReconnected: () => {
        handlersRef.current.forEach((h) => h.onReconnected?.())
      },
    }

    const conn = createChatRealtimeConnection(getAccessToken, hubHandlers)
    connectionRef.current = conn
    void startChatRealtimeConnection(conn)

    return () => {
      void disposeChatRealtimeConnection(conn)
      connectionRef.current = null
    }
  }, [isAuthenticated])

  const value = useMemo(
    () => ({ register, setActiveConversationId, getActiveConversationId }),
    [register, setActiveConversationId, getActiveConversationId]
  )

  return <ChatRealtimeContext.Provider value={value}>{children}</ChatRealtimeContext.Provider>
}

export function useChatRealtimeContext() {
  const ctx = useContext(ChatRealtimeContext)
  if (!ctx) {
    throw new Error('useChatRealtimeContext chỉ dùng bên trong ChatRealtimeProvider (nhóm Chat)')
  }
  return ctx
}

/** Đăng ký listener; cập nhật handler qua ref.current để tránh re-subscribe mỗi render. */
export function useChatRealtime(handlers: ChatRealtimeHandler) {
  const { register } = useChatRealtimeContext()
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    return register({
      onConversationUpdated: (c) => ref.current.onConversationUpdated?.(c),
      onChatMessageReceived: (p) => ref.current.onChatMessageReceived?.(p),
      onReconnected: () => ref.current.onReconnected?.(),
    })
  }, [register])
}
