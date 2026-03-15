import { contextBridge, ipcRenderer } from 'electron'

// Type-safe IPC bridge
const api = {
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args) as Promise<T>
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  once: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args))
  },

  // Streaming support via MessagePort
  createStreamPort: (channel: string, ...args: unknown[]): Promise<void> => {
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('api', api)

// Expose type for renderer
export type ElectronAPI = typeof api
