import { create } from 'zustand'
import type { Message } from '../types/skill'
import { ipcInvoke } from '../lib/ipc-client'
import { v4 as uuid } from 'uuid'

interface ChatState {
  messages: Message[]
  loading: boolean
  activeAgent: string | null

  sendMessage: (content: string, systemPrompt: string, tools?: unknown[]) => Promise<void>
  clearMessages: () => void
  setActiveAgent: (agent: string | null) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  activeAgent: null,

  sendMessage: async (content, systemPrompt, tools) => {
    const userMessage: Message = {
      id: uuid(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    }

    set((s) => ({ messages: [...s.messages, userMessage], loading: true }))

    try {
      const response = await ipcInvoke('llm:chat', {
        messages: get().messages.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt,
        tools: tools as never,
        stream: false
      })

      const assistantMessage: Message = {
        id: uuid(),
        role: 'assistant',
        content: response.content,
        metadata: response.toolCalls ? { toolCalls: response.toolCalls } : undefined,
        createdAt: new Date().toISOString()
      }

      set((s) => ({ messages: [...s.messages, assistantMessage], loading: false }))
    } catch (error) {
      const errorMessage: Message = {
        id: uuid(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdAt: new Date().toISOString()
      }
      set((s) => ({ messages: [...s.messages, errorMessage], loading: false }))
    }
  },

  clearMessages: () => set({ messages: [] }),
  setActiveAgent: (agent) => set({ activeAgent: agent })
}))
