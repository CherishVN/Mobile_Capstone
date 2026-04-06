import { Stack } from 'expo-router'
import { ChatRealtimeProvider } from '@/contexts/chat-realtime-context'

export default function MessagesLayout() {
  return (
    <ChatRealtimeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[conversationId]" />
      </Stack>
    </ChatRealtimeProvider>
  )
}
