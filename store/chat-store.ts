import { create } from 'zustand'
import { ChatMessageDto, ConversationDto } from '@/types/conversation'

interface ChatState {
  conversationsList: ConversationDto[]
  messagesByConversation: Record<string, ChatMessageDto[]>
  conversationsById: Record<string, ConversationDto>
  loadMessages: (conversationId: string, messages: ChatMessageDto[]) => void
  addMessage: (conversationId: string, message: ChatMessageDto) => void
  setConversationDetail: (conversationId: string, conversation: ConversationDto) => void
  setConversationsList: (list: ConversationDto[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversationsList: [],
  messagesByConversation: {},
  conversationsById: {},

  loadMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const prev = state.messagesByConversation[conversationId] || []
      // Check for temporary optimistic message to swap it if ID changes
      const filtered = prev.filter(m => !m.id.toString().startsWith('tmp-'))
      // Check for exact duplicate IDs (rare but good to ensure uniqueness)
      const isExist = filtered.find(m => m.id === message.id)
      
      const newMessages = isExist ? filtered : [...filtered, message]
      
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: newMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        },
      }
    }),

  setConversationDetail: (conversationId, conversation) =>
    set((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [conversationId]: conversation,
      },
    })),

  setConversationsList: (list) => set({ conversationsList: list }),
}))
