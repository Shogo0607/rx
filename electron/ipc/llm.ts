import { ipcMain, BrowserWindow } from 'electron'
import { llmService } from '../services/openai'

interface LlmChatInput {
  messages: Array<{ role: string; content: string }>
  systemPrompt: string
  tools?: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  model?: string
  stream?: boolean
}

export function registerLlmHandlers(): void {
  ipcMain.handle('llm:chat', async (event, input: LlmChatInput) => {
    if (input.stream) {
      // For streaming, send chunks via the sender's webContents
      const webContents = event.sender
      const streamId = crypto.randomUUID()

      // Notify renderer of stream start
      webContents.send('llm:stream-start', { streamId })

      try {
        const result = await llmService.chatStream(
          {
            messages: input.messages,
            systemPrompt: input.systemPrompt,
            model: input.model,
            tools: input.tools
          },
          (chunk) => {
            if (!webContents.isDestroyed()) {
              webContents.send('llm:stream-chunk', {
                streamId,
                content: chunk.content,
                done: chunk.done
              })
            }
          }
        )

        return {
          content: result.content,
          streamId
        }
      } catch (error) {
        if (!webContents.isDestroyed()) {
          webContents.send('llm:stream-chunk', {
            streamId,
            done: true,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
        throw error
      }
    } else {
      // Non-streaming request
      return llmService.chat({
        messages: input.messages,
        systemPrompt: input.systemPrompt,
        model: input.model,
        tools: input.tools
      })
    }
  })

  ipcMain.handle('llm:models', async () => {
    return llmService.listModels()
  })
}
