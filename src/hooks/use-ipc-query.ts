import { useState, useEffect, useCallback, useRef } from 'react'
import { ipcInvoke } from '../lib/ipc-client'
import type { IpcChannelMap } from '../types/ipc'

/**
 * Hook for reading data from IPC channels.
 * Automatically fetches on mount and when args change.
 */
export function useIpcQuery<K extends keyof IpcChannelMap>(
  channel: K,
  ...args: IpcChannelMap[K]['args'] extends void ? [] : [IpcChannelMap[K]['args']]
): {
  data: IpcChannelMap[K]['result'] | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [data, setData] = useState<IpcChannelMap[K]['result'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const serializedArgs = JSON.stringify(args)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await (ipcInvoke as Function)(channel, ...args)
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, serializedArgs])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    return () => {
      mountedRef.current = false
    }
  }, [fetchData])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return { data, loading, error, refetch }
}

/**
 * Hook for mutations (create, update, delete).
 * Returns a mutate function that can be called imperatively.
 */
export function useIpcMutation<K extends keyof IpcChannelMap>(
  channel: K
): {
  mutate: (
    ...args: IpcChannelMap[K]['args'] extends void ? [] : [IpcChannelMap[K]['args']]
  ) => Promise<IpcChannelMap[K]['result']>
  loading: boolean
  error: Error | null
} {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(
    async (
      ...args: IpcChannelMap[K]['args'] extends void ? [] : [IpcChannelMap[K]['args']]
    ): Promise<IpcChannelMap[K]['result']> => {
      setLoading(true)
      setError(null)
      try {
        const result = await (ipcInvoke as Function)(channel, ...args)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [channel]
  )

  return { mutate, loading, error }
}
