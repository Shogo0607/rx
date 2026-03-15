import type { ComponentType } from 'react'

export type SkillCategory = 'research' | 'analysis' | 'writing' | 'management' | 'custom'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface SkillDefinition {
  id: string
  name: string
  nameKey?: string
  description: string
  descriptionKey?: string
  icon: string
  category: SkillCategory
  systemPrompt: string
  tools: ToolDefinition[]
  component: ComponentType<SkillProps>
  order: number
  enabled: boolean
}

export interface SkillProps {
  projectId: string | null
  onNavigate?: (skillId: string) => void
}

export interface SkillContext {
  projectId: string | null
  sendMessage: (message: string) => void
  getConversation: () => Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata?: Record<string, unknown>
  createdAt: string
}
