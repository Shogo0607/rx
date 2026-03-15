import { create } from 'zustand'
import { ipcInvoke, ipcOn } from '../lib/ipc-client'
import type {
  PatentPipelineRun,
  PriorArtPatent,
  PipelineProgressEvent,
  GapAnalysis,
  GeneratedIdeas,
  MermaidDiagram
} from '../types/ipc'

interface PatentPipelineState {
  // State
  currentRun: PatentPipelineRun | null
  pipelineRuns: PatentPipelineRun[]
  priorArtPatents: PriorArtPatent[]
  pipelineStatus: string
  progressData: unknown
  isLoading: boolean

  // Actions
  loadRuns: (projectId: string) => Promise<void>
  loadPriorArt: (projectId: string, pipelineRunId?: string) => Promise<void>
  createPipeline: (projectId: string, inventionDescription: string, template: string, mode: 'auto' | 'semi-auto', jurisdiction?: string) => Promise<PatentPipelineRun>
  startPipeline: (runId: string) => Promise<void>
  pausePipeline: (runId: string) => Promise<void>
  resumePipeline: (runId: string) => Promise<void>
  refreshRun: (runId: string) => Promise<void>
  setCurrentRun: (run: PatentPipelineRun | null) => void
  updateRunData: (runId: string, updates: Record<string, unknown>) => Promise<void>
  initProgressListener: () => (() => void)
}

export const usePatentPipelineStore = create<PatentPipelineState>((set, get) => ({
  currentRun: null,
  pipelineRuns: [],
  priorArtPatents: [],
  pipelineStatus: 'idle',
  progressData: null,
  isLoading: false,

  loadRuns: async (projectId: string) => {
    try {
      const runs = await ipcInvoke('pipeline:list', { projectId }) as PatentPipelineRun[]
      set({ pipelineRuns: runs })
      // Set the most recent run as current if none selected
      if (!get().currentRun && runs.length > 0) {
        set({ currentRun: runs[0] })
      }
    } catch (err) {
      console.error('[patent-pipeline-store] Failed to load runs:', err)
    }
  },

  loadPriorArt: async (projectId: string, pipelineRunId?: string) => {
    try {
      const patents = await ipcInvoke('prior-art:list', { projectId, pipelineRunId }) as PriorArtPatent[]
      set({ priorArtPatents: patents })
    } catch (err) {
      console.error('[patent-pipeline-store] Failed to load prior art:', err)
    }
  },

  createPipeline: async (projectId: string, inventionDescription: string, template: string, mode: 'auto' | 'semi-auto', jurisdiction?: string) => {
    set({ isLoading: true })
    try {
      const run = await ipcInvoke('pipeline:create', {
        projectId,
        inventionDescription,
        template,
        mode,
        jurisdiction
      }) as PatentPipelineRun
      set((state) => ({
        currentRun: run,
        pipelineRuns: [run, ...state.pipelineRuns],
        isLoading: false
      }))
      return run
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  startPipeline: async (runId: string) => {
    set({ pipelineStatus: 'starting' })
    await ipcInvoke('pipeline:start', runId)
    set({ pipelineStatus: 'running' })
    // Immediately refresh to pick up 'researching' status from DB
    get().refreshRun(runId)
  },

  pausePipeline: async (runId: string) => {
    await ipcInvoke('pipeline:pause', runId)
    set({ pipelineStatus: 'paused' })
  },

  resumePipeline: async (runId: string) => {
    set({ pipelineStatus: 'running' })
    await ipcInvoke('pipeline:resume', runId)
  },

  refreshRun: async (runId: string) => {
    try {
      const run = await ipcInvoke('pipeline:get', runId) as PatentPipelineRun | null
      if (run) {
        set((state) => ({
          currentRun: state.currentRun?.id === run.id ? run : state.currentRun,
          pipelineRuns: state.pipelineRuns.map((r) => r.id === run.id ? run : r)
        }))
      }
    } catch (err) {
      console.error('[patent-pipeline-store] Failed to refresh run:', err)
    }
  },

  setCurrentRun: (run: PatentPipelineRun | null) => {
    set({ currentRun: run })
  },

  updateRunData: async (runId: string, updates: Record<string, unknown>) => {
    try {
      const run = await ipcInvoke('pipeline:update', { id: runId, ...updates }) as PatentPipelineRun
      set((state) => ({
        currentRun: state.currentRun?.id === run.id ? run : state.currentRun,
        pipelineRuns: state.pipelineRuns.map((r) => r.id === run.id ? run : r)
      }))
    } catch (err) {
      console.error('[patent-pipeline-store] Failed to update run:', err)
    }
  },

  initProgressListener: () => {
    return ipcOn('pipeline:progress', (raw: unknown) => {
      const data = raw as PipelineProgressEvent
      const currentRun = get().currentRun
      // Only update status/progress for the current run
      if (currentRun && currentRun.id === data.runId) {
        set({
          pipelineStatus: data.status,
          progressData: data.data
        })
      }

      // Auto-refresh the run data on any progress event
      get().refreshRun(data.runId)
      // Also reload prior art if research step completed
      if (data.step === 1 && ['step_completed', 'completed'].includes(data.status)) {
        const run = get().currentRun
        if (run && run.id === data.runId) {
          get().loadPriorArt(run.projectId, run.id)
        }
      }
    })
  }
}))
