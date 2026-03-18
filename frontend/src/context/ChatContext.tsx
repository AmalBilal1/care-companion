import { createContext, useContext, useState, type ReactNode } from 'react'
import { sendChatMessage } from '../api/chat'
import { useAuth } from './AuthContext'

export interface Message {
  id: string
  role: 'user' | 'agent'
  text: string
}

interface ChatContextType {
  messages: Message[]
  isLoading: boolean
  isEmergency: boolean
  sendMessage: (text: string) => Promise<void>
  dismissEmergency: () => void
  clearMessages: () => void
}

const ChatContext = createContext<ChatContextType>({
  messages: [],
  isLoading: false,
  isEmergency: false,
  sendMessage: async () => {},
  dismissEmergency: () => {},
  clearMessages: () => {},
})

const EMERGENCY_TRIGGERS = [
  'call 911',
  'EMERGENCY WARNING',
  'go to the nearest ER',
  'call 911 or go',
]

function isEmergencyResponse(text: string): boolean {
  return EMERGENCY_TRIGGERS.some(trigger =>
    text.toLowerCase().includes(trigger.toLowerCase())
  )
}

let idCounter = 0
function newId() {
  return `msg_${++idCounter}_${Date.now()}`
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isEmergency, setIsEmergency] = useState(false)

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { id: newId(), role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const response = await sendChatMessage(text, user?.email, user?.name)
      const agentMsg: Message = { id: newId(), role: 'agent', text: response }
      setMessages(prev => [...prev, agentMsg])
      if (isEmergencyResponse(response)) {
        setIsEmergency(true)
      }
    } catch (err) {
      const errorMsg: Message = {
        id: newId(),
        role: 'agent',
        text: err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Something went wrong. Please try again.',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  function dismissEmergency() {
    setIsEmergency(false)
  }

  function clearMessages() {
    setMessages([])
  }

  return (
    <ChatContext.Provider value={{ messages, isLoading, isEmergency, sendMessage, dismissEmergency, clearMessages }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  return useContext(ChatContext)
}
