import {
  HubConnection,
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr'
import { CONFIG } from '@/config'
import type { ChatMessageDto, ConversationDto } from '@/types/conversation'

export type ChatMessageReceivedPayload = {
  conversationId?: string
  message?: ChatMessageDto
}

export type ChatRealtimeHubHandlers = {
  onConversationUpdated?: (conversation: ConversationDto) => void
  onChatMessageReceived?: (payload: ChatMessageReceivedPayload) => void
  onReconnected?: () => void
}

/**
 * Cùng hub với FE: `services/chat-realtime.ts` → `/hubs/order-tracking`
 */
export function createChatRealtimeConnection(
  getToken: () => Promise<string | null>,
  handlers: ChatRealtimeHubHandlers
): HubConnection | null {
  const apiUrl = CONFIG.api.baseUrl
  if (!apiUrl) return null
  const normalized = apiUrl.replace(/\/$/, '')

  const connection = new HubConnectionBuilder()
    .withUrl(`${normalized}/hubs/order-tracking`, {
      accessTokenFactory: async () => (await getToken()) ?? '',
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.None)
    .build()

  if (handlers.onConversationUpdated) {
    connection.on('ConversationUpdated', handlers.onConversationUpdated)
  }
  if (handlers.onChatMessageReceived) {
    connection.on('ChatMessageReceived', handlers.onChatMessageReceived)
  }
  if (handlers.onReconnected) {
    connection.onreconnected(() => handlers.onReconnected?.())
  }

  return connection
}

export async function startChatRealtimeConnection(connection: HubConnection | null): Promise<void> {
  if (!connection) return
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await connection.start()
      return
    } catch {
      if (attempt === 5) return
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

export async function disposeChatRealtimeConnection(connection: HubConnection | null): Promise<void> {
  if (!connection) return
  connection.off('ConversationUpdated')
  connection.off('ChatMessageReceived')
  await connection.stop()
}
