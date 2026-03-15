import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useUiStore } from '../../stores/ui-store'
import { useSkillStore } from '../../stores/skill-store'
import { X, Send, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'

export function AiChatPanel() {
  const t = useT()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages = useChatStore((s) => s.messages)
  const loading = useChatStore((s) => s.loading)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const setChatPanelOpen = useUiStore((s) => s.setChatPanelOpen)
  const activeSkillId = useUiStore((s) => s.activeSkillId)
  const getSkill = useSkillStore((s) => s.getSkill)

  const activeSkill = getSkill(activeSkillId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput('')
    await sendMessage(
      trimmed,
      activeSkill?.systemPrompt ?? 'You are a helpful research assistant.',
      activeSkill?.tools
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <aside className="flex flex-col w-80 border-l border-border bg-card animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{t('chat.title')}</span>
          {activeSkill && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {activeSkill.nameKey ? t(activeSkill.nameKey as TranslationKey) : activeSkill.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setChatPanelOpen(false)}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('chat.emptyPrompt')}</p>
            <p className="text-xs mt-1">{t('chat.poweredBy')}</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-2',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role !== 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2">
              <span className="text-sm text-muted-foreground">{t('chat.thinking')}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
