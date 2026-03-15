import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getDb } from './database'

interface ChatParams {
  messages: Array<{ role: string; content: string }>
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
}

interface ChatResponse {
  content: string
  toolCalls?: Array<{
    name: string
    arguments: Record<string, unknown>
  }>
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

interface StructuredOutputParams {
  prompt: string
  systemPrompt?: string
  schema: Record<string, unknown>
  model?: string
}

export class LLMService {
  private client: OpenAI | null = null
  private currentApiKey: string | null = null

  private getApiKey(): string {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as
      | { value: string }
      | undefined

    if (!row?.value) {
      throw new Error(
        'OpenAI API key not configured. Set it in Settings.'
      )
    }
    return row.value
  }

  private getClient(): OpenAI {
    const apiKey = this.getApiKey()

    // Re-create client if API key has changed
    if (!this.client || apiKey !== this.currentApiKey) {
      // Check for custom base URL
      const db = getDb()
      const baseUrlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_base_url') as
        | { value: string }
        | undefined

      this.client = new OpenAI({
        apiKey,
        ...(baseUrlRow?.value ? { baseURL: baseUrlRow.value } : {})
      })
      this.currentApiKey = apiKey
    }

    return this.client
  }

  private getDefaultModel(): string {
    try {
      const db = getDb()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_model') as
        | { value: string }
        | undefined
      return row?.value || 'gpt-4o'
    } catch {
      return 'gpt-4o'
    }
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const client = this.getClient()
    const model = params.model || this.getDefaultModel()

    const messages: ChatCompletionMessageParam[] = []

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }

    for (const msg of params.messages) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })
    }

    const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: params.temperature ?? 0.7,
      ...(params.maxTokens ? { max_completion_tokens: params.maxTokens } : {})
    }

    // Add tools if provided
    if (params.tools && params.tools.length > 0) {
      requestParams.tools = params.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }))
    }

    console.log(`[llm] chat() called - model: ${model}, messages: ${messages.length}, maxTokens: ${params.maxTokens || 'default'}, temperature: ${params.temperature ?? 0.7}`)

    const maxRetries = 2
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[llm] chat() attempt ${attempt + 1}/${maxRetries + 1} sending request...`)
        const completion = await client.chat.completions.create(requestParams)
        const choice = completion.choices[0]

        if (!choice) {
          console.error('[llm] chat() API returned no choices', JSON.stringify(completion))
          throw new Error('API returned no choices in response')
        }

        console.log(`[llm] chat() success - finish_reason: ${choice.finish_reason}, content length: ${choice.message.content?.length || 0}`)

        const response: ChatResponse = {
          content: choice.message.content || ''
        }

        // Extract tool calls
        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          response.toolCalls = choice.message.tool_calls.map((tc) => ({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        }

        // Usage info
        if (completion.usage) {
          response.usage = {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens
          }
          console.log(`[llm] chat() usage - prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens}`)
        }

        return response
      } catch (error: unknown) {
        const err = error as Error & { status?: number; code?: string; type?: string }
        console.error(`[llm] chat() attempt ${attempt + 1} failed - status: ${err.status}, code: ${err.code}, type: ${err.type}, message: ${err.message}`)

        if (err.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your settings.')
        }
        // Retry on rate limit or server errors
        if ((err.status === 429 || (err.status && err.status >= 500)) && attempt < maxRetries) {
          console.log(`[llm] Retrying in ${(attempt + 1) * 2}s...`)
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000))
          continue
        }
        if (err.status === 429) {
          throw new Error('OpenAI rate limit exceeded. Please wait and try again.')
        }
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to OpenAI API. Check your network connection.')
        }
        // If max_completion_tokens is rejected, try max_tokens; if both fail, retry without either
        if (err.message && (err.message.includes('max_completion_tokens') || err.message.includes('max_tokens'))) {
          if ((requestParams as Record<string, unknown>).max_completion_tokens) {
            const tokens = (requestParams as Record<string, unknown>).max_completion_tokens
            console.warn('[llm] max_completion_tokens rejected, falling back to max_tokens...')
            delete (requestParams as Record<string, unknown>).max_completion_tokens
            ;(requestParams as Record<string, unknown>).max_tokens = tokens
            continue
          } else {
            console.warn('[llm] max_tokens also rejected, retrying without token limit...')
            delete (requestParams as Record<string, unknown>).max_tokens
            continue
          }
        }
        throw new Error(`LLM request failed: ${err.message}`)
      }
    }
    throw new Error('LLM request failed after retries')
  }

  async chatStream(
    params: ChatParams,
    onChunk: (chunk: { content?: string; done: boolean }) => void
  ): Promise<ChatResponse> {
    const client = this.getClient()
    const model = params.model || this.getDefaultModel()

    const messages: ChatCompletionMessageParam[] = []

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }

    for (const msg of params.messages) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })
    }

    try {
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: params.temperature ?? 0.7,
        ...(params.maxTokens ? { max_completion_tokens: params.maxTokens } : {}),
        stream: true
      })

      let fullContent = ''

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          fullContent += delta.content
          onChunk({ content: delta.content, done: false })
        }
      }

      onChunk({ done: true })

      return { content: fullContent }
    } catch (error: unknown) {
      const err = error as Error & { status?: number }
      onChunk({ done: true })
      throw new Error(`LLM streaming failed: ${err.message}`)
    }
  }

  async structuredOutput(params: StructuredOutputParams): Promise<unknown> {
    const client = this.getClient()
    const model = params.model || this.getDefaultModel()

    const messages: ChatCompletionMessageParam[] = []

    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }

    messages.push({ role: 'user', content: params.prompt })

    const maxRetries = 2
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'structured_output',
              schema: params.schema,
              strict: true
            }
          }
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in structured output response')
        }

        return JSON.parse(content)
      } catch (error: unknown) {
        const err = error as Error & { status?: number; code?: string }

        // Retry on rate limit or server errors
        if ((err.status === 429 || (err.status && err.status >= 500)) && attempt < maxRetries) {
          console.warn(`[llm] structuredOutput attempt ${attempt + 1} failed (status ${err.status}), retrying in ${(attempt + 1) * 2}s...`)
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000))
          continue
        }

        // Fall back to regular JSON prompting if json_schema not supported
        if (err.message.includes('json_schema')) {
          console.warn('[llm] json_schema not supported, falling back to json_object mode')
          const fallbackMessages: ChatCompletionMessageParam[] = [
            {
              role: 'system',
              content: `${params.systemPrompt || 'You are a helpful assistant.'}\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(params.schema, null, 2)}`
            },
            { role: 'user', content: params.prompt }
          ]

          const fallback = await client.chat.completions.create({
            model,
            messages: fallbackMessages,
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })

          const fallbackContent = fallback.choices[0]?.message?.content
          if (!fallbackContent) {
            throw new Error('No content in fallback structured output response')
          }

          return JSON.parse(fallbackContent)
        }

        console.error(`[llm] structuredOutput failed: ${err.message}`, err.stack)
        throw new Error(`Structured output failed: ${err.message}`)
      }
    }
    throw new Error('Structured output failed after retries')
  }

  async listModels(): Promise<string[]> {
    try {
      const client = this.getClient()
      const models = await client.models.list()
      return models.data
        .filter((m) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
        .map((m) => m.id)
        .sort()
    } catch {
      // Return sensible defaults if API call fails
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    }
  }
}

// Singleton instance
export const llmService = new LLMService()
