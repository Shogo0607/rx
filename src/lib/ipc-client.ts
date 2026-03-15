import type { IpcChannelMap } from '../types/ipc'

declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
      once: (channel: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

/**
 * Type-safe IPC client for renderer process
 */
export async function ipcInvoke<K extends keyof IpcChannelMap>(
  channel: K,
  ...args: IpcChannelMap[K]['args'] extends void ? [] : [IpcChannelMap[K]['args']]
): Promise<IpcChannelMap[K]['result']> {
  return window.api.invoke(channel, ...args)
}

export function ipcOn(channel: string, callback: (...args: unknown[]) => void): () => void {
  return window.api.on(channel, callback)
}
