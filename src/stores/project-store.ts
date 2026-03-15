import { create } from 'zustand'
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types/project'
import { ipcInvoke } from '../lib/ipc-client'

interface ProjectState {
  projects: Project[]
  currentProjectId: string | null
  loading: boolean

  // Actions
  loadProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (input: UpdateProjectInput) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (id: string | null) => void
  getCurrentProject: () => Project | null
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true })
    try {
      const projects = await ipcInvoke('project:list')
      set({ projects, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createProject: async (input) => {
    console.log('[project-store] createProject called with:', input)
    const project = await ipcInvoke('project:create', input)
    console.log('[project-store] createProject result:', project)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  updateProject: async (input) => {
    const updated = await ipcInvoke('project:update', input)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === updated.id ? updated : p))
    }))
  },

  deleteProject: async (id) => {
    await ipcInvoke('project:delete', id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
    }))
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),

  getCurrentProject: () => {
    const { projects, currentProjectId } = get()
    return projects.find((p) => p.id === currentProjectId) ?? null
  }
}))
